import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import process from 'node:process'

const SUPPORTED_PANE_COUNTS = new Set([1, 4, 9])
const SUPPORTED_RENDERER_POLICIES = new Set(['automatic', 'prefer-gpu', 'safe-dom'])
const SUPPORTED_SETTINGS_OPERATIONS = new Set(['observe', 'reset'])
const EFFECTIVE_RENDERERS = new Set(['dom', 'webgl'])
const RENDERER_FALLBACK_REASONS = new Set([
  'automatic-agent-safe',
  'policy-safe',
  'webgl-unavailable',
  'webgl-load-failed',
  'webgl-context-lost',
  'none',
])

function resolveThroughExistingAncestor(candidate) {
  let ancestor = candidate
  const missingSegments = []
  while (!fs.existsSync(ancestor)) {
    const parent = path.dirname(ancestor)
    if (parent === ancestor) break
    missingSegments.unshift(path.basename(ancestor))
    ancestor = parent
  }
  return path.resolve(fs.realpathSync(ancestor), ...missingSegments)
}

function isSameOrAncestor(candidate, target) {
  const relative = path.relative(candidate, target)
  return relative === ''
    || (!path.isAbsolute(relative) && relative !== '..' && !relative.startsWith(`..${path.sep}`))
}

function validateExplicitProfileDirectory(candidate) {
  const physicalCandidate = resolveThroughExistingAncestor(candidate)
  const physicalHome = resolveThroughExistingAncestor(path.resolve(os.homedir()))
  const physicalWorkspace = resolveThroughExistingAncestor(path.resolve(process.cwd()))
  const temporaryRoots = [os.tmpdir()]
  // Keep the common macOS spelling even on Linux. `/private/tmp` is normally a
  // symlink to `/tmp` on macOS, but can be a distinct (or absent) broad path on
  // Linux; both spellings must be rejected before a profile is created there.
  if (process.platform !== 'win32') temporaryRoots.push('/tmp', '/private/tmp', '/var/tmp')
  const physicalTemporaryRoots = temporaryRoots.map(root =>
    resolveThroughExistingAncestor(path.resolve(root))
  )
  const isBroadHomePath = isSameOrAncestor(physicalCandidate, physicalHome)
  const overlapsWorkspace = isSameOrAncestor(physicalCandidate, physicalWorkspace)
    || isSameOrAncestor(physicalWorkspace, physicalCandidate)
  const isBroadTemporaryPath = physicalTemporaryRoots.some(root =>
    isSameOrAncestor(physicalCandidate, root)
  )

  if (isBroadHomePath || overlapsWorkspace || isBroadTemporaryPath) {
    throw new Error('--profile-dir must be a dedicated directory outside broad home, workspace, and temporary roots')
  }
}

function positiveInteger(value, flagName) {
  if (!/^[1-9]\d*$/.test(value)) {
    throw new Error(`${flagName} must be a positive integer`)
  }
  const parsed = Number.parseInt(value, 10)
  if (!Number.isSafeInteger(parsed) || parsed <= 0) {
    throw new Error(`${flagName} must be a positive integer`)
  }
  return parsed
}

function nonNegativeInteger(value, flagName) {
  if (!/^\d+$/.test(value)) throw new Error(`${flagName} must be a non-negative integer`)
  const parsed = Number.parseInt(value, 10)
  if (!Number.isSafeInteger(parsed)) throw new Error(`${flagName} must be a non-negative integer`)
  return parsed
}

export function readSingleFlag(argumentsList, name, fallback) {
  const prefix = `--${name}=`
  const matches = argumentsList.filter(argument => argument.startsWith(prefix))
  if (matches.length > 1) throw new Error(`--${name} must be provided only once`)
  return matches[0]?.slice(prefix.length) ?? fallback
}

export function parseSoakArguments(argumentsList) {
  const paneCountsValue = readSingleFlag(argumentsList, 'pane-counts', '1,4,9')
  const paneCounts = paneCountsValue.split(',').map(value => positiveInteger(value, '--pane-counts'))

  if (paneCounts.length === 0 || paneCounts.some(value => !SUPPORTED_PANE_COUNTS.has(value))) {
    throw new Error('--pane-counts must contain only 1, 4, or 9')
  }
  if (new Set(paneCounts).size !== paneCounts.length) {
    throw new Error('--pane-counts must not contain duplicates')
  }

  const rendererPolicy = readSingleFlag(argumentsList, 'renderer-policy', 'automatic')
  if (!SUPPORTED_RENDERER_POLICIES.has(rendererPolicy)) {
    throw new Error('--renderer-policy must be automatic, prefer-gpu, or safe-dom')
  }
  const settingsOperationValue = readSingleFlag(argumentsList, 'settings-operation', '')
  if (settingsOperationValue && !SUPPORTED_SETTINGS_OPERATIONS.has(settingsOperationValue)) {
    throw new Error('--settings-operation must be observe or reset')
  }
  const profileDirectoryValue = readSingleFlag(argumentsList, 'profile-dir', '')
  let profileDirectory = null
  if (profileDirectoryValue) {
    if (!path.isAbsolute(profileDirectoryValue)) {
      throw new Error('--profile-dir must be an absolute path')
    }
    profileDirectory = path.resolve(profileDirectoryValue)
    if (profileDirectory === path.parse(profileDirectory).root) {
      throw new Error('--profile-dir must not be a filesystem root')
    }
    validateExplicitProfileDirectory(profileDirectory)
    if (paneCounts.length !== 1) {
      throw new Error('--profile-dir requires exactly one pane count')
    }
  }

  return {
    paneCounts,
    durationSeconds: positiveInteger(readSingleFlag(argumentsList, 'duration-seconds', '30'), '--duration-seconds'),
    sampleIntervalMs: positiveInteger(readSingleFlag(argumentsList, 'sample-interval-ms', '5000'), '--sample-interval-ms'),
    canonicalIntervalSeconds: nonNegativeInteger(
      readSingleFlag(argumentsList, 'canonical-interval-seconds', '0'),
      '--canonical-interval-seconds',
    ),
    rendererPolicy,
    profileDirectory,
    settingsOperation: settingsOperationValue || null,
  }
}

export function createProfileDirectoryPlan({ profileDirectory, paneCount, makeTemporaryDirectory }) {
  if (profileDirectory) return { profileDirectory, cleanup: false }
  return {
    profileDirectory: makeTemporaryDirectory(`multiclaude-packaged-soak-${paneCount}-`),
    cleanup: true,
  }
}

export function validateRendererEvidence({
  terminalIds,
  statuses,
  policy,
  safeAgentTerminalIds = [],
}) {
  const failures = []
  if (!SUPPORTED_RENDERER_POLICIES.has(policy)) failures.push('renderer policy is invalid')
  const expectedIds = new Set(terminalIds)
  const safeAgentIds = new Set(safeAgentTerminalIds)
  const observedIds = new Set()
  for (const status of statuses) {
    const keys = Object.keys(status).sort()
    if (keys.join(',') !== 'effective,fallbackReason,terminalId') {
      failures.push(`${status.terminalId ?? 'unknown'}: renderer evidence contains unsupported fields`)
      continue
    }
    if (!expectedIds.has(status.terminalId)) failures.push(`${status.terminalId}: renderer status is not live`)
    if (observedIds.has(status.terminalId)) failures.push(`${status.terminalId}: duplicate renderer status`)
    observedIds.add(status.terminalId)
    if (!EFFECTIVE_RENDERERS.has(status.effective)) failures.push(`${status.terminalId}: invalid effective renderer`)
    if (!RENDERER_FALLBACK_REASONS.has(status.fallbackReason)) failures.push(`${status.terminalId}: invalid fallback reason`)
    if (status.effective === 'webgl' && status.fallbackReason !== 'none') {
      failures.push(`${status.terminalId}: WebGL status must not have a fallback reason`)
    }
    if (policy === 'safe-dom' && status.effective !== 'dom') {
      failures.push(`${status.terminalId}: Compatibility must resolve to DOM`)
    }
    const expectedPolicyReason = policy === 'safe-dom'
      ? 'policy-safe'
      : policy === 'automatic' && safeAgentIds.has(status.terminalId)
        ? 'automatic-agent-safe'
        : null
    if (expectedPolicyReason !== null) {
      if (status.effective !== 'dom' || status.fallbackReason !== expectedPolicyReason) {
        failures.push(`${status.terminalId}: renderer status contradicts the selected policy`)
      }
    } else {
      const validWebGLResult = status.effective === 'webgl' && status.fallbackReason === 'none'
      const validWebGLFallback = status.effective === 'dom'
        && ['webgl-unavailable', 'webgl-load-failed', 'webgl-context-lost'].includes(status.fallbackReason)
      if (!validWebGLResult && !validWebGLFallback) {
        failures.push(`${status.terminalId}: renderer status contradicts a WebGL attempt`)
      }
    }
  }
  for (const terminalId of terminalIds) {
    if (!statuses.some(status => status.terminalId === terminalId)) {
      failures.push(`${terminalId}: missing renderer status`)
    }
  }
  return { ok: failures.length === 0, failures }
}

export function validateRendererCleanupEvidence({
  originalTerminalIds,
  closedTerminalId,
  remainingTerminalIds,
  registryCount,
  statuses,
  policy,
}) {
  const failures = []
  const expectedRemainingIds = originalTerminalIds.filter(id => id !== closedTerminalId)
  if (!originalTerminalIds.includes(closedTerminalId)) {
    failures.push('closed terminal was not part of the live renderer set')
  }
  if (registryCount !== expectedRemainingIds.length) {
    failures.push('renderer registry count did not match the remaining terminal count')
  }
  if (
    [...remainingTerminalIds].sort().join(',')
    !== [...expectedRemainingIds].sort().join(',')
  ) {
    failures.push('remaining renderer terminal IDs did not match the live terminal set')
  }
  const statusValidation = validateRendererEvidence({
    terminalIds: expectedRemainingIds,
    statuses,
    policy,
  })
  failures.push(...statusValidation.failures)
  return { ok: failures.length === 0, failures }
}

export function attestSingleSoakEvidence(evidence, { expectedPolicy, expectedPaneCount }) {
  const failures = []
  if (evidence?.failure) failures.push('soak evidence contains a top-level failure')
  if (!Array.isArray(evidence?.results) || evidence.results.length !== 1) {
    failures.push('soak evidence must contain exactly one result')
  }
  if (!SUPPORTED_RENDERER_POLICIES.has(expectedPolicy)) failures.push('expected renderer policy is invalid')
  if (!SUPPORTED_PANE_COUNTS.has(expectedPaneCount)) failures.push('expected pane count must be 1, 4, or 9')
  if (evidence?.environment?.rendererPolicy !== expectedPolicy) {
    failures.push('renderer policy provenance mismatch')
  }
  const provenanceCounts = evidence?.environment?.paneCounts
  if (!Array.isArray(provenanceCounts)
    || provenanceCounts.length !== 1
    || provenanceCounts[0] !== expectedPaneCount) {
    failures.push('pane count provenance mismatch')
  }
  if (evidence?.results?.[0]?.paneCount !== expectedPaneCount) {
    failures.push('result pane count mismatch')
  }
  const result = evidence?.results?.length === 1 ? evidence.results[0] : null
  if (result) {
    const terminalEvidence = result.terminalEvidence
    const terminalIds = terminalEvidence?.terminalIds
    if (!Array.isArray(terminalIds)
      || terminalIds.length !== expectedPaneCount
      || new Set(terminalIds).size !== terminalIds.length) {
      failures.push('terminal evidence count mismatch')
    } else {
      const terminalValidation = validateTerminalEvidence(terminalEvidence)
      if (!terminalValidation.ok || terminalEvidence.ok !== true) {
        failures.push('terminal correctness evidence is invalid')
      }
      const rendererEvidence = result.rendererEvidence
      const rendererValidation = validateRendererEvidence({
        terminalIds,
        statuses: Array.isArray(rendererEvidence?.statuses) ? rendererEvidence.statuses : [],
        policy: rendererEvidence?.policy,
      })
      const cleanup = rendererEvidence?.cleanup
      const cleanupValidation = validateRendererCleanupEvidence({
        originalTerminalIds: terminalIds,
        closedTerminalId: cleanup?.closedTerminalId,
        remainingTerminalIds: Array.isArray(cleanup?.remainingTerminalIds)
          ? cleanup.remainingTerminalIds
          : [],
        registryCount: cleanup?.registryCount,
        statuses: Array.isArray(cleanup?.statuses) ? cleanup.statuses : [],
        policy: rendererEvidence?.policy,
      })
      if (rendererEvidence?.policy !== expectedPolicy
        || !rendererValidation.ok
        || rendererEvidence?.ok !== true
        || cleanup?.ok !== true
        || !cleanupValidation.ok) {
        failures.push('renderer evidence is invalid')
      }
      if (!Array.isArray(rendererEvidence?.finalStatuses)) {
        failures.push('final renderer evidence is required')
      } else {
        const finalValidation = validateRendererEvidence({
          terminalIds,
          statuses: rendererEvidence.finalStatuses,
          policy: rendererEvidence.policy,
        })
        if (!finalValidation.ok) failures.push('final renderer evidence is invalid')
      }
    }

    if (!Array.isArray(result.rawAttributionSamples) || result.rawAttributionSamples.length === 0) {
      failures.push('raw attribution samples are required')
    } else {
      for (const sample of result.rawAttributionSamples) {
        try {
          validateAttributionSample(sample)
          if (sample.terminalCount !== expectedPaneCount) {
            failures.push('attribution sample terminal count mismatch')
            break
          }
        } catch {
          failures.push('raw attribution sample is invalid')
          break
        }
      }
    }
  }
  return { ok: failures.length === 0, failures }
}

export function workspaceRelativeEvidenceSource(inputPath, workspacePath) {
  const relative = path.relative(path.resolve(workspacePath), path.resolve(inputPath))
  if (!relative || relative.startsWith('..') || path.isAbsolute(relative)) {
    throw new Error('soak evidence source must be inside the workspace')
  }
  return relative.split(path.sep).join('/')
}

export function evidenceExecutableIdentifier(executablePath, workspacePath) {
  const relative = path.relative(path.resolve(workspacePath), path.resolve(executablePath))
  if (relative && !relative.startsWith('..') && !path.isAbsolute(relative)) {
    return relative.split(path.sep).join('/')
  }
  return 'external-artifact/redacted'
}

function round(value) {
  return Number(value.toFixed(2))
}

export function summarizeProcessSamples(samples) {
  const observations = new Map()
  for (const sample of samples) {
    const key = `${sample.recordedAtMs}:${sample.type}`
    const observation = observations.get(key) ?? {
      recordedAtMs: sample.recordedAtMs,
      type: sample.type,
      workingSetMiB: 0,
      cpuPercent: 0,
    }
    observation.workingSetMiB += sample.workingSetMiB
    observation.cpuPercent += sample.cpuPercent
    observations.set(key, observation)
  }

  const groups = new Map()
  for (const sample of [...observations.values()].sort((left, right) => left.recordedAtMs - right.recordedAtMs)) {
    const group = groups.get(sample.type) ?? []
    group.push(sample)
    groups.set(sample.type, group)
  }

  return Object.fromEntries([...groups.entries()].map(([type, group]) => [type, {
    samples: group.length,
    peakWorkingSetMiB: round(Math.max(...group.map(sample => sample.workingSetMiB))),
    finalWorkingSetMiB: round(group.at(-1).workingSetMiB),
    peakCpuPercent: round(Math.max(...group.map(sample => sample.cpuPercent))),
  }]))
}

function summarizeRange(samples, key) {
  const values = samples.map(sample => sample[key])
  return {
    first: round(values[0]),
    peak: round(Math.max(...values)),
    final: round(values.at(-1)),
  }
}

function requireNonNegativeInteger(value, label) {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new Error(`${label} must be a non-negative integer`)
  }
}

export function aggregateCanonicalEvidence(markerResults) {
  const aggregate = { bytes: 0, watermark: 0 }
  for (const result of markerResults) {
    requireNonNegativeInteger(result.canonical?.bytes, 'canonical bytes')
    requireNonNegativeInteger(result.canonical?.watermark, 'canonical watermark')
    aggregate.bytes += result.canonical.bytes
    aggregate.watermark += result.canonical.watermark
    requireNonNegativeInteger(aggregate.bytes, 'aggregate canonical bytes')
    requireNonNegativeInteger(aggregate.watermark, 'aggregate canonical watermark')
  }
  return aggregate
}

export function validateAttributionSample(sample) {
  const memoryFields = [
    'recordedAtMs',
    'mainPrivateMiB',
    'mainSharedMiB',
    'mainHeapUsedMiB',
    'mainHeapTotalMiB',
  ]
  for (const field of memoryFields) {
    if (!Number.isFinite(sample[field]) || sample[field] < 0) {
      throw new Error(`${field} must be finite and non-negative`)
    }
  }
  requireNonNegativeInteger(sample.canonicalBytes, 'canonicalBytes')
  requireNonNegativeInteger(sample.canonicalWatermark, 'canonicalWatermark')
  if (!Number.isSafeInteger(sample.terminalCount) || sample.terminalCount <= 0) {
    throw new Error('terminalCount must be a positive integer')
  }
  if (sample.mainHeapUsedMiB > sample.mainHeapTotalMiB) {
    throw new Error('mainHeapUsedMiB must not exceed mainHeapTotalMiB')
  }
}

export function summarizeAttributionSamples(samples) {
  if (samples.length === 0) throw new Error('attribution samples are required')
  for (const sample of samples) validateAttributionSample(sample)

  return {
    samples: samples.length,
    mainPrivateMiB: summarizeRange(samples, 'mainPrivateMiB'),
    mainSharedMiB: summarizeRange(samples, 'mainSharedMiB'),
    mainHeapUsedMiB: summarizeRange(samples, 'mainHeapUsedMiB'),
    mainHeapTotalMiB: summarizeRange(samples, 'mainHeapTotalMiB'),
    canonicalBytes: summarizeRange(samples, 'canonicalBytes'),
    canonicalWatermark: {
      first: samples[0].canonicalWatermark,
      final: samples.at(-1).canonicalWatermark,
    },
    terminalCount: samples.at(-1).terminalCount,
  }
}

function median(values) {
  const sorted = [...values].sort((left, right) => left - right)
  const middle = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 0
    ? (sorted[middle - 1] + sorted[middle]) / 2
    : sorted[middle]
}

function summarizeTrendPoints(samples, key, scale) {
  if (samples.length < 4) throw new Error('at least four samples are required for a steady-state trend')
  const points = samples.map(sample => ({
    minutes: sample.recordedAtMs / 60_000,
    value: sample[key] * scale,
  }))
  if (points.some(point => !Number.isFinite(point.minutes) || !Number.isFinite(point.value))) {
    throw new Error(`${key} trend values must be finite`)
  }
  const meanTime = points.reduce((sum, point) => sum + point.minutes, 0) / points.length
  const meanValue = points.reduce((sum, point) => sum + point.value, 0) / points.length
  const denominator = points.reduce((sum, point) => sum + (point.minutes - meanTime) ** 2, 0)
  if (denominator === 0) throw new Error('steady-state samples must span time')
  const slope = points.reduce(
    (sum, point) => sum + (point.minutes - meanTime) * (point.value - meanValue),
    0,
  ) / denominator
  const tailSize = Math.max(1, Math.floor(points.length / 5))
  const firstWindowMedian = median(points.slice(0, tailSize).map(point => point.value))
  const finalWindowMedian = median(points.slice(-tailSize).map(point => point.value))
  const minimum = Math.min(...points.map(point => point.value))
  const maximum = Math.max(...points.map(point => point.value))
  const observedRange = maximum - minimum
  return {
    samples: points.length,
    slopePerMinute: round(slope),
    firstWindowMedian: round(firstWindowMedian),
    finalWindowMedian: round(finalWindowMedian),
    windowMedianDrift: round(finalWindowMedian - firstWindowMedian),
    driftAsRangeFraction: observedRange === 0
      ? 0
      : round((finalWindowMedian - firstWindowMedian) / observedRange),
    minimum: round(minimum),
    maximum: round(maximum),
  }
}

/** OLS trend over the second half of a run, after startup/warm-up effects. */
export function summarizeSteadyStateTrend(samples, key, scale = 1) {
  if (samples.length < 4) throw new Error('at least four samples are required for a steady-state trend')
  const steady = samples.slice(Math.floor(samples.length / 2))
  return summarizeTrendPoints(steady, key, scale)
}

/** Trend over an explicit elapsed-time window, used after bounded buffers saturate. */
export function summarizeTrendWindow(samples, key, startAtMs, scale = 1) {
  if (!Number.isFinite(startAtMs) || startAtMs < 0) throw new Error('startAtMs must be finite and non-negative')
  return summarizeTrendPoints(samples.filter(sample => sample.recordedAtMs >= startAtMs), key, scale)
}

/**
 * Fail-closed memory gate for the deterministic 30-minute packaged soak.
 * The last ten minutes are evaluated after the 20k-line canonical scrollback
 * and bounded restore tail have saturated. Budgets scale with pane count and
 * use window medians so expected V8 GC spikes do not masquerade as retention.
 */
export function evaluateMemoryAcceptance({ samples, paneCount, elapsedSeconds, correctness }) {
  const failures = []
  if (correctness !== true) failures.push('terminal correctness failed')
  if (!Number.isInteger(paneCount) || paneCount <= 0) failures.push('paneCount must be a positive integer')
  if (!Number.isFinite(elapsedSeconds) || elapsedSeconds < 1_800) failures.push('memory soak must run for at least 1800 seconds')
  if (samples.some(sample => sample.terminalCount !== undefined && sample.terminalCount !== paneCount)) {
    failures.push('attribution sample terminal count mismatch')
  }
  if (failures.length > 0) return { ok: false, failures }

  const startAtMs = elapsedSeconds * 1_000 - 10 * 60_000
  const windowSamples = samples.filter(sample => sample.recordedAtMs >= startAtMs)
  if (windowSamples.length < 60) {
    return { ok: false, failures: ['post-saturation window requires at least 60 samples'] }
  }

  const trends = {
    mainPrivateMiB: summarizeTrendPoints(windowSamples, 'mainPrivateMiB', 1),
    mainHeapUsedMiB: summarizeTrendPoints(windowSamples, 'mainHeapUsedMiB', 1),
    canonicalMiB: summarizeTrendPoints(windowSamples, 'canonicalBytes', 1 / 1_048_576),
  }
  const limits = {
    mainPrivateSlopePerMinute: round(0.25 * paneCount),
    mainPrivateMedianDriftMiB: round(4 * paneCount),
    mainHeapSlopePerMinute: round(0.15 * paneCount),
    mainHeapMedianDriftMiB: round(2 * paneCount),
    canonicalSlopePerMinute: round(0.01 * paneCount),
    canonicalMedianDriftMiB: round(0.05 * paneCount),
  }
  const checks = [
    ['main private slope', trends.mainPrivateMiB.slopePerMinute, limits.mainPrivateSlopePerMinute],
    ['main private median drift', trends.mainPrivateMiB.windowMedianDrift, limits.mainPrivateMedianDriftMiB],
    ['main heap slope', trends.mainHeapUsedMiB.slopePerMinute, limits.mainHeapSlopePerMinute],
    ['main heap median drift', trends.mainHeapUsedMiB.windowMedianDrift, limits.mainHeapMedianDriftMiB],
    ['canonical slope', trends.canonicalMiB.slopePerMinute, limits.canonicalSlopePerMinute],
    ['canonical median drift', trends.canonicalMiB.windowMedianDrift, limits.canonicalMedianDriftMiB],
  ]
  for (const [label, observed, limit] of checks) {
    if (observed > limit) failures.push(`${label} ${observed} exceeded ${limit}`)
  }
  return { ok: failures.length === 0, failures, startAtMs, limits, trends }
}

export function validateTerminalEvidence({ terminalIds, streams, liveMarkers, canonicalMarkers }) {
  const failures = []

  for (const terminalId of terminalIds) {
    const stream = streams[terminalId]
    if (!stream) {
      failures.push(`${terminalId}: missing stream evidence`)
      continue
    }
    if (stream.firstSequence !== 1) failures.push(`${terminalId}: first sequence was ${stream.firstSequence}, expected 1`)
    if (stream.lastSequence - stream.firstSequence + 1 !== stream.chunks) {
      failures.push(`${terminalId}: sequence range does not match ${stream.chunks} observed chunks`)
    }
    if (stream.gaps !== 0) failures.push(`${terminalId}: ${stream.gaps} sequence gap(s)`)
    if (stream.duplicates !== 0) failures.push(`${terminalId}: ${stream.duplicates} duplicate sequence(s)`)
    if (stream.epochs.length !== 1) failures.push(`${terminalId}: expected one epoch, observed ${stream.epochs.length}`)
    if (liveMarkers[terminalId] !== true) failures.push(`${terminalId}: final live marker missing from sequenced IPC output`)
    if (canonicalMarkers[terminalId] !== true) failures.push(`${terminalId}: final canonical marker missing from snapshot`)
  }

  return { ok: failures.length === 0, failures }
}
