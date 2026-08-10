import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import process from 'node:process'
import test from 'node:test'

import {
  aggregateCanonicalEvidence,
  attestSingleSoakEvidence,
  evaluateMemoryAcceptance,
  createProfileDirectoryPlan,
  evidenceExecutableIdentifier,
  parseSoakArguments,
  readSingleFlag,
  summarizeAttributionSamples,
  summarizeProcessSamples,
  summarizeSteadyStateTrend,
  summarizeTrendWindow,
  validateTerminalEvidence,
  validateRendererCleanupEvidence,
  validateRendererEvidence,
  workspaceRelativeEvidenceSource,
} from './packaged-terminal-soak-lib.mjs'

test('aggregateCanonicalEvidence sums multi-terminal snapshot metadata and rejects invalid values', () => {
  assert.deepEqual(aggregateCanonicalEvidence([
    { canonical: { bytes: 1_000, watermark: 10 } },
    { canonical: { bytes: 2_500, watermark: 20 } },
    { canonical: { bytes: 500, watermark: 5 } },
  ]), { bytes: 4_000, watermark: 35 })

  assert.throws(
    () => aggregateCanonicalEvidence([{ canonical: { bytes: Number.NaN, watermark: 1 } }]),
    /canonical bytes must be a non-negative integer/
  )
})

test('readSingleFlag returns one string value and rejects ambiguous repeats', () => {
  assert.equal(readSingleFlag(['--output=one.json'], 'output', ''), 'one.json')
  assert.equal(readSingleFlag([], 'output', ''), '')
  assert.throws(
    () => readSingleFlag(['--output=one.json', '--output=two.json'], 'output', ''),
    /--output must be provided only once/
  )
})

test('parseSoakArguments accepts bounded pane counts and duration', () => {
  assert.deepEqual(
    parseSoakArguments(['--pane-counts=1,4,9', '--duration-seconds=1800', '--sample-interval-ms=5000']),
    {
      paneCounts: [1, 4, 9],
      durationSeconds: 1800,
      sampleIntervalMs: 5000,
      canonicalIntervalSeconds: 0,
      rendererPolicy: 'automatic',
      profileDirectory: null,
      settingsOperation: null,
    }
  )
})

test('parseSoakArguments accepts closed renderer policy, explicit profile, and settings operation', () => {
  const profileDirectory = path.resolve('/tmp/multiclaude-explicit-profile')
  assert.deepEqual(parseSoakArguments([
    '--pane-counts=4',
    '--renderer-policy=safe-dom',
    `--profile-dir=${profileDirectory}`,
    '--settings-operation=observe',
  ]), {
    paneCounts: [4],
    durationSeconds: 30,
    sampleIntervalMs: 5000,
    canonicalIntervalSeconds: 0,
    rendererPolicy: 'safe-dom',
    profileDirectory,
    settingsOperation: 'observe',
  })
  assert.throws(() => parseSoakArguments(['--renderer-policy=quality']), /renderer-policy/)
  assert.throws(() => parseSoakArguments(['--profile-dir=relative']), /absolute path/)
  assert.throws(() => parseSoakArguments([`--profile-dir=${path.parse(process.cwd()).root}`]), /filesystem root/)
  assert.throws(
    () => parseSoakArguments([`--profile-dir=${profileDirectory}`, '--pane-counts=1,4']),
    /exactly one pane count/,
  )
  assert.throws(() => parseSoakArguments(['--settings-operation=delete']), /observe or reset/)
})

test('parseSoakArguments rejects broad or workspace-overlapping explicit profiles', (t) => {
  const temporaryDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'multiclaude-profile-guard-'))
  const workspaceLink = path.join(temporaryDirectory, 'workspace-link')
  fs.symlinkSync(process.cwd(), workspaceLink, 'dir')
  t.after(() => fs.rmSync(temporaryDirectory, { recursive: true, force: true }))

  for (const unsafePath of [
    os.homedir(),
    path.dirname(os.homedir()),
    process.cwd(),
    path.dirname(process.cwd()),
    path.join(process.cwd(), 'profile-data'),
    os.tmpdir(),
    ...(process.platform === 'win32' ? [] : ['/tmp', '/private/tmp', '/var/tmp']),
    workspaceLink,
  ]) {
    assert.throws(
      () => parseSoakArguments([`--profile-dir=${unsafePath}`, '--pane-counts=1']),
      /dedicated directory/,
    )
  }
})

test('explicit profile plans are caller-owned while generated profiles are cleaned up', () => {
  const explicit = path.resolve('/tmp/multiclaude-explicit-profile')
  assert.deepEqual(createProfileDirectoryPlan({
    profileDirectory: explicit,
    paneCount: 1,
    makeTemporaryDirectory: () => assert.fail('must not allocate a temporary profile'),
  }), { profileDirectory: explicit, cleanup: false })
  assert.deepEqual(createProfileDirectoryPlan({
    profileDirectory: null,
    paneCount: 9,
    makeTemporaryDirectory: prefix => `/tmp/${prefix}owned`,
  }), { profileDirectory: '/tmp/multiclaude-packaged-soak-9-owned', cleanup: true })
})

test('validateRendererEvidence accepts typed fallback and rejects orphans, arbitrary fields, and policy mismatch', () => {
  assert.equal(validateRendererEvidence({
    terminalIds: ['t1', 't2'],
    policy: 'prefer-gpu',
    statuses: [
      { terminalId: 't1', effective: 'webgl', fallbackReason: 'none' },
      { terminalId: 't2', effective: 'dom', fallbackReason: 'webgl-load-failed' },
    ],
  }).ok, true)

  const failed = validateRendererEvidence({
    terminalIds: ['t1'],
    policy: 'safe-dom',
    statuses: [
      { terminalId: 'orphan', effective: 'webgl', fallbackReason: 'raw driver error', title: 'SECRET' },
    ],
  })
  assert.equal(failed.ok, false)
  assert.match(failed.failures.join(' '), /unsupported fields|not live|missing renderer status/)
  assert.doesNotMatch(JSON.stringify(failed), /SECRET|driver error/)

  for (const incompatible of [
    {
      policy: 'automatic',
      statuses: [{ terminalId: 't1', effective: 'dom', fallbackReason: 'policy-safe' }],
    },
    {
      policy: 'prefer-gpu',
      statuses: [{ terminalId: 't1', effective: 'dom', fallbackReason: 'automatic-agent-safe' }],
    },
    {
      policy: 'safe-dom',
      statuses: [{ terminalId: 't1', effective: 'dom', fallbackReason: 'webgl-load-failed' }],
    },
  ]) {
    assert.equal(validateRendererEvidence({
      terminalIds: ['t1'],
      ...incompatible,
    }).ok, false)
  }
})

test('validateRendererCleanupEvidence requires typed remaining statuses and exact registry cleanup', () => {
  const valid = {
    originalTerminalIds: ['t1', 't2'],
    closedTerminalId: 't2',
    remainingTerminalIds: ['t1'],
    registryCount: 1,
    statuses: [{ terminalId: 't1', effective: 'webgl', fallbackReason: 'none' }],
    policy: 'automatic',
  }
  assert.equal(validateRendererCleanupEvidence(valid).ok, true)
  assert.equal(validateRendererCleanupEvidence({ ...valid, registryCount: 2 }).ok, false)
  assert.equal(validateRendererCleanupEvidence({ ...valid, statuses: [] }).ok, false)
})

test('attestSingleSoakEvidence rejects failures, substitutions, and multi-result documents', () => {
  const terminalEvidence = {
    terminalIds: ['t1'],
    streams: {
      t1: { firstSequence: 1, lastSequence: 1, chunks: 1, gaps: 0, duplicates: 0, epochs: ['e1'] },
    },
    liveMarkers: { t1: true },
    canonicalMarkers: { t1: true },
    ok: true,
  }
  const rendererEvidence = {
    policy: 'automatic',
    statuses: [{ terminalId: 't1', effective: 'webgl', fallbackReason: 'none' }],
    finalStatuses: [{ terminalId: 't1', effective: 'webgl', fallbackReason: 'none' }],
    cleanup: {
      closedTerminalId: 't1',
      remainingTerminalIds: [],
      registryCount: 0,
      statuses: [],
      ok: true,
    },
    ok: true,
  }
  const rawAttributionSamples = [{
    recordedAtMs: 1,
    mainPrivateMiB: 120,
    mainSharedMiB: 40,
    mainHeapUsedMiB: 25,
    mainHeapTotalMiB: 32,
    canonicalBytes: 1_000,
    canonicalWatermark: 10,
    terminalCount: 1,
  }]
  const valid = {
    environment: { rendererPolicy: 'automatic', paneCounts: [1] },
    results: [{ paneCount: 1, terminalEvidence, rendererEvidence, rawAttributionSamples }],
  }
  assert.equal(attestSingleSoakEvidence(valid, {
    expectedPolicy: 'automatic',
    expectedPaneCount: 1,
  }).ok, true)

  for (const evidence of [
    { ...valid, failure: { code: 'run-failed' } },
    { ...valid, results: [...valid.results, ...valid.results] },
    { ...valid, environment: { rendererPolicy: 'safe-dom', paneCounts: [1] } },
    { ...valid, environment: { rendererPolicy: 'automatic', paneCounts: [9] } },
    {
      ...valid,
      results: [{
        ...valid.results[0],
        rendererEvidence: {
          ...rendererEvidence,
          policy: 'safe-dom',
          statuses: [{ terminalId: 't1', effective: 'dom', fallbackReason: 'policy-safe' }],
          finalStatuses: [{ terminalId: 't1', effective: 'dom', fallbackReason: 'policy-safe' }],
        },
      }],
    },
    {
      ...valid,
      results: [{
        ...valid.results[0],
        terminalEvidence: { ...terminalEvidence, ok: true, liveMarkers: { t1: false } },
      }],
    },
    {
      ...valid,
      results: [{
        ...valid.results[0],
        rawAttributionSamples: [{ ...rawAttributionSamples[0], terminalCount: 9 }],
      }],
    },
    {
      ...valid,
      results: [{
        ...valid.results[0],
        rendererEvidence: {
          ...rendererEvidence,
          statuses: [{ terminalId: 't1', effective: 'dom', fallbackReason: 'policy-safe' }],
        },
      }],
    },
    {
      ...valid,
      results: [{
        ...valid.results[0],
        rendererEvidence: {
          ...rendererEvidence,
          cleanup: { ...rendererEvidence.cleanup, registryCount: 1, ok: true },
        },
      }],
    },
  ]) {
    assert.equal(attestSingleSoakEvidence(evidence, {
      expectedPolicy: 'automatic',
      expectedPaneCount: 1,
    }).ok, false)
  }
})

test('workspaceRelativeEvidenceSource emits no absolute or user-specific source path', () => {
  const workspace = path.resolve('/workspace/multiclaude')
  assert.equal(
    workspaceRelativeEvidenceSource('/workspace/multiclaude/plans/report.json', workspace),
    'plans/report.json',
  )
  assert.throws(
    () => workspaceRelativeEvidenceSource('/Users/private/report.json', workspace),
    /inside the workspace/,
  )
})

test('evidenceExecutableIdentifier redacts executables outside the workspace', () => {
  const workspace = path.resolve('/workspace/multiclaude')
  assert.equal(
    evidenceExecutableIdentifier('/workspace/multiclaude/release/MultiClaude', workspace),
    'release/MultiClaude',
  )
  assert.equal(
    evidenceExecutableIdentifier('/tmp/private-build/MultiClaude', workspace),
    'external-artifact/redacted',
  )
  assert.equal(
    evidenceExecutableIdentifier('/tmp/private-build/customer-acme-debug-build', workspace),
    'external-artifact/redacted',
  )
})

test('parseSoakArguments rejects unsupported pane counts', () => {
  assert.throws(
    () => parseSoakArguments(['--pane-counts=1,8']),
    /pane-counts must contain only 1, 4, or 9/
  )
})

test('summarizeProcessSamples reports peak and final working-set memory by process type', () => {
  assert.deepEqual(summarizeProcessSamples([
    { recordedAtMs: 1, pid: 1, type: 'Browser', workingSetMiB: 60, cpuPercent: 1 },
    { recordedAtMs: 1, pid: 2, type: 'Browser', workingSetMiB: 40, cpuPercent: 1 },
    { recordedAtMs: 1, pid: 3, type: 'Tab', workingSetMiB: 80, cpuPercent: 4 },
    { recordedAtMs: 2, pid: 1, type: 'Browser', workingSetMiB: 70, cpuPercent: 2 },
    { recordedAtMs: 2, pid: 2, type: 'Browser', workingSetMiB: 50, cpuPercent: 1 },
    { recordedAtMs: 2, pid: 3, type: 'Tab', workingSetMiB: 75, cpuPercent: 1 },
  ]), {
    Browser: { samples: 2, peakWorkingSetMiB: 120, finalWorkingSetMiB: 120, peakCpuPercent: 3 },
    Tab: { samples: 2, peakWorkingSetMiB: 80, finalWorkingSetMiB: 75, peakCpuPercent: 4 },
  })
})

test('summarizeAttributionSamples reports main heap/private memory and canonical retention without content', () => {
  assert.deepEqual(summarizeAttributionSamples([
    {
      recordedAtMs: 1,
      mainPrivateMiB: 120,
      mainSharedMiB: 40,
      mainHeapUsedMiB: 25,
      mainHeapTotalMiB: 32,
      canonicalBytes: 1_000,
      canonicalWatermark: 10,
      terminalCount: 1,
    },
    {
      recordedAtMs: 2,
      mainPrivateMiB: 150,
      mainSharedMiB: 42,
      mainHeapUsedMiB: 20,
      mainHeapTotalMiB: 40,
      canonicalBytes: 1_500,
      canonicalWatermark: 20,
      terminalCount: 1,
    },
  ]), {
    samples: 2,
    mainPrivateMiB: { first: 120, peak: 150, final: 150 },
    mainSharedMiB: { first: 40, peak: 42, final: 42 },
    mainHeapUsedMiB: { first: 25, peak: 25, final: 20 },
    mainHeapTotalMiB: { first: 32, peak: 40, final: 40 },
    canonicalBytes: { first: 1_000, peak: 1_500, final: 1_500 },
    canonicalWatermark: { first: 10, final: 20 },
    terminalCount: 1,
  })
})

test('summarizeAttributionSamples rejects non-finite, negative, or malformed evidence', () => {
  const valid = {
    recordedAtMs: 1,
    mainPrivateMiB: 120,
    mainSharedMiB: 40,
    mainHeapUsedMiB: 25,
    mainHeapTotalMiB: 32,
    canonicalBytes: 1_000,
    canonicalWatermark: 10,
    terminalCount: 1,
  }

  assert.throws(
    () => summarizeAttributionSamples([{ ...valid, mainPrivateMiB: Number.NaN }]),
    /mainPrivateMiB must be finite and non-negative/
  )
  assert.throws(
    () => summarizeAttributionSamples([{ ...valid, mainHeapUsedMiB: -1 }]),
    /mainHeapUsedMiB must be finite and non-negative/
  )
  assert.throws(
    () => summarizeAttributionSamples([{ ...valid, canonicalWatermark: 1.5 }]),
    /canonicalWatermark must be a non-negative integer/
  )
  assert.throws(
    () => summarizeAttributionSamples([{ ...valid, terminalCount: 0 }]),
    /terminalCount must be a positive integer/
  )
})

test('summarizeSteadyStateTrend excludes warm-up and reports a reproducible OLS slope', () => {
  const samples = Array.from({ length: 10 }, (_, index) => ({
    recordedAtMs: index * 60_000,
    heap: index < 5 ? 1_000 + index * 100 : 50 + index * 2,
  }))
  assert.deepEqual(summarizeSteadyStateTrend(samples, 'heap'), {
    samples: 5,
    slopePerMinute: 2,
    firstWindowMedian: 60,
    finalWindowMedian: 68,
    windowMedianDrift: 8,
    driftAsRangeFraction: 1,
    minimum: 60,
    maximum: 68,
  })
  assert.throws(() => summarizeSteadyStateTrend(samples.slice(0, 3), 'heap'), /at least four/)
})

test('summarizeTrendWindow evaluates only samples after the requested elapsed time', () => {
  const samples = Array.from({ length: 10 }, (_, index) => ({
    recordedAtMs: index * 60_000,
    heap: index,
  }))
  assert.deepEqual(summarizeTrendWindow(samples, 'heap', 6 * 60_000), {
    samples: 4,
    slopePerMinute: 1,
    firstWindowMedian: 6,
    finalWindowMedian: 9,
    windowMedianDrift: 3,
    driftAsRangeFraction: 1,
    minimum: 6,
    maximum: 9,
  })
})

test('evaluateMemoryAcceptance gates the post-saturation window and fails closed', () => {
  const stable = Array.from({ length: 120 }, (_, index) => ({
    recordedAtMs: 20 * 60_000 + index * 5_000,
    mainPrivateMiB: 800 + index * 0.1,
    mainHeapUsedMiB: 100 + index * 0.01,
    canonicalBytes: 8 * 1_048_576,
  }))
  const passed = evaluateMemoryAcceptance({
    samples: stable,
    paneCount: 9,
    elapsedSeconds: 1_800,
    correctness: true,
  })
  assert.equal(passed.ok, true)
  assert.equal(passed.failures.length, 0)

  const growing = stable.map((sample, index) => ({
    ...sample,
    mainPrivateMiB: 800 + index * 2,
    mainHeapUsedMiB: 100 + index,
  }))
  const failed = evaluateMemoryAcceptance({
    samples: growing,
    paneCount: 9,
    elapsedSeconds: 1_800,
    correctness: true,
  })
  assert.equal(failed.ok, false)
  assert.match(failed.failures.join(' '), /private|heap/)
  assert.equal(evaluateMemoryAcceptance({
    samples: stable,
    paneCount: 9,
    elapsedSeconds: 1_799,
    correctness: true,
  }).ok, false)
})

test('validateTerminalEvidence fails closed on gaps, duplicates, epoch drift, or missing markers', () => {
  assert.equal(validateTerminalEvidence({
    terminalIds: ['t1'],
    streams: { t1: { firstSequence: 1, lastSequence: 3, chunks: 3, gaps: 0, duplicates: 0, epochs: ['e1'] } },
    liveMarkers: { t1: true },
    canonicalMarkers: { t1: true },
  }).ok, true)

  const failed = validateTerminalEvidence({
    terminalIds: ['t1'],
    streams: { t1: { firstSequence: 2, lastSequence: 4, chunks: 2, gaps: 1, duplicates: 0, epochs: ['e1', 'e2'] } },
    liveMarkers: { t1: false },
    canonicalMarkers: { t1: false },
  })
  assert.equal(failed.ok, false)
  assert.match(failed.failures.join(' '), /sequence|range|gap|epoch|live marker|canonical marker/i)
})

test('validateTerminalEvidence reports missing streams and duplicates independently', () => {
  const failed = validateTerminalEvidence({
    terminalIds: ['missing', 'duplicate'],
    streams: {
      duplicate: { firstSequence: 1, lastSequence: 2, chunks: 2, gaps: 0, duplicates: 2, epochs: ['e1'] },
    },
    liveMarkers: { missing: true, duplicate: true },
    canonicalMarkers: { missing: true, duplicate: true },
  })

  assert.equal(failed.ok, false)
  assert.match(failed.failures.join(' '), /missing stream evidence/i)
  assert.match(failed.failures.join(' '), /2 duplicate sequence/i)
})

test('validateTerminalEvidence rejects live loss even when the canonical marker is present', () => {
  const failed = validateTerminalEvidence({
    terminalIds: ['t1'],
    streams: { t1: { firstSequence: 1, lastSequence: 1, chunks: 1, gaps: 0, duplicates: 0, epochs: ['e1'] } },
    liveMarkers: { t1: false },
    canonicalMarkers: { t1: true },
  })

  assert.equal(failed.ok, false)
  assert.match(failed.failures.join(' '), /live marker/i)
})

test('parseSoakArguments rejects duplicate pane counts and non-positive timing', () => {
  assert.throws(() => parseSoakArguments(['--pane-counts=1,1']), /must not contain duplicates/)
  assert.throws(() => parseSoakArguments(['--duration-seconds=0']), /positive integer/)
  assert.throws(() => parseSoakArguments(['--sample-interval-ms=-1']), /positive integer/)
  assert.throws(() => parseSoakArguments(['--canonical-interval-seconds=-1']), /non-negative integer/)
})

test('parseSoakArguments accepts a sparse canonical-check interval', () => {
  assert.equal(parseSoakArguments(['--canonical-interval-seconds=60']).canonicalIntervalSeconds, 60)
})

test('parseSoakArguments rejects partial numeric values and repeated flags', () => {
  for (const value of ['1e3', '1.5', '1junk']) {
    assert.throws(() => parseSoakArguments([`--duration-seconds=${value}`]), /positive integer/)
  }
  assert.throws(
    () => parseSoakArguments(['--duration-seconds=1', '--duration-seconds=2']),
    /must be provided only once/
  )
})
