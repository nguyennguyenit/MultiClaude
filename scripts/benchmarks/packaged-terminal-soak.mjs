import fs from 'node:fs'
import { createHash } from 'node:crypto'
import os from 'node:os'
import path from 'node:path'
import process from 'node:process'
import { _electron as electron } from '@playwright/test'

import {
  aggregateCanonicalEvidence,
  createProfileDirectoryPlan,
  evidenceExecutableIdentifier,
  parseSoakArguments,
  readSingleFlag,
  summarizeAttributionSamples,
  summarizeProcessSamples,
  validateAttributionSample,
  validateTerminalEvidence,
  validateRendererEvidence,
} from './packaged-terminal-soak-lib.mjs'

const DEFAULT_EXECUTABLE = path.resolve('release/mac-arm64/MultiClaude.app/Contents/MacOS/MultiClaude')
const MARKER_TIMEOUT_MS = 60_000

function delay(milliseconds) {
  return new Promise(resolve => setTimeout(resolve, milliseconds))
}

function sha256File(filePath) {
  return createHash('sha256').update(fs.readFileSync(filePath)).digest('hex')
}

function writeJsonAtomic(outputPath, value) {
  const resolved = path.resolve(outputPath)
  const temporary = `${resolved}.tmp-${process.pid}`
  fs.mkdirSync(path.dirname(resolved), { recursive: true })
  fs.writeFileSync(temporary, `${JSON.stringify(value, null, 2)}\n`, 'utf8')
  fs.renameSync(temporary, resolved)
}

function octalEscape(value) {
  return [...Buffer.from(value)].map(byte => `\\${byte.toString(8).padStart(3, '0')}`).join('')
}

function workloadCommand(marker) {
  const escapedMarker = octalEscape(marker)
  return `/bin/sh -c 'i=0; while [ "$i" -lt 128 ]; do printf "MC_SOAK_LINE_%04d_%072d\\n" "$i" "$i"; i=$((i+1)); done; printf "${escapedMarker}\\n"'\r`
}

async function closeElectronApp(app) {
  const child = app.process()
  let timeout
  const closedGracefully = await Promise.race([
    app.close().then(() => true, () => false),
    new Promise(resolve => {
      timeout = setTimeout(() => resolve(false), 5_000)
    }),
  ])
  if (timeout) clearTimeout(timeout)

  if (!closedGracefully && child.exitCode === null) {
    child.kill('SIGKILL')
    await Promise.race([
      new Promise(resolve => child.once('exit', resolve)),
      delay(1_000),
    ])
  }
}

async function addTerminal(window) {
  const terminals = window.locator('[data-terminal-id]')
  const initialCount = await terminals.count()
  const actionButton = window.getByRole('button', { name: 'New Terminal', exact: true })
  const emptyButton = window.getByRole('button', { name: /\+ New Terminal/ })

  if (await actionButton.isVisible()) await actionButton.click()
  else await emptyButton.click()

  const deadline = Date.now() + 10_000
  while (await terminals.count() !== initialCount + 1) {
    if (Date.now() >= deadline) throw new Error(`terminal count did not reach ${initialCount + 1}`)
    await delay(50)
  }
}

async function installSoakProject(window, projectPath) {
  const project = {
    id: 'packaged-soak-project',
    name: 'Packaged Soak',
    path: projectPath,
    skipGitSetup: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }
  const installed = await window.evaluate(projectData => {
    const store = window.__APP_STORE__
    if (!store) return false
    const state = store.getState()
    store.setState({ terminals: [] })
    state.setProjects([projectData])
    state.setActiveProject(projectData.id)
    return true
  }, project)
  if (!installed) throw new Error('renderer app store is unavailable')
  await window.waitForSelector('[data-testid="project-tab-packaged-soak-project"]', { timeout: 5_000 })
}

function redactSettings(settings) {
  return {
    settingsSchemaVersion: Number.isSafeInteger(settings?.settingsSchemaVersion)
      ? settings.settingsSchemaVersion
      : null,
    terminalRendererPolicy: ['automatic', 'prefer-gpu', 'safe-dom'].includes(settings?.terminalRendererPolicy)
      ? settings.terminalRendererPolicy
      : null,
    hasRetiredRendererKeys: Boolean(
      settings
      && (Object.hasOwn(settings, 'terminalRenderMode')
        || Object.hasOwn(settings, 'gpuRendererForClaudeTerminals'))
    ),
  }
}

async function prepareSettings(window, rendererPolicy, settingsOperation) {
  const before = await window.evaluate(() => window.electron.settings.get())
  let after = before
  if (settingsOperation === 'reset') {
    after = await window.evaluate(() => window.electron.settings.reset())
  } else if (settingsOperation === null) {
    after = await window.evaluate(policy => window.electron.settings.set({
      terminalRendererPolicy: policy,
    }), rendererPolicy)
  }
  return { operation: settingsOperation ?? 'apply-policy', before: redactSettings(before), after: redactSettings(after) }
}

async function collectRendererEvidence(window, terminalIds) {
  for (const terminalId of terminalIds) {
    const activated = await window.evaluate(id => {
      const store = window.__APP_STORE__
      if (!store) return false
      store.getState().setActiveTerminal(id)
      return true
    }, terminalId)
    if (!activated) throw new Error('renderer app store is unavailable during pane activation')
    const activePane = window.locator(`[data-terminal-id="${terminalId}"] .pane-tab.active`)
    const activationDeadline = Date.now() + 5_000
    while (await activePane.count() !== 1) {
      if (Date.now() >= activationDeadline) throw new Error('terminal pane did not become active')
      await delay(25)
    }
    await delay(100)
    await window.evaluate(() => new Promise(resolve => requestAnimationFrame(() => resolve())))
    await window.evaluate(() => new Promise(resolve => requestAnimationFrame(() => resolve())))
    await window.locator('[data-testid="settings-button"]').click()
    await window.locator('[data-testid="settings-tab-diagnostics"]').click()
    const activeStatus = window.locator(`[data-renderer-terminal-id="${terminalId}"]`)
    const statusDeadline = Date.now() + 10_000
    while (true) {
      const effective = await activeStatus.getAttribute('data-renderer-effective')
      const fallback = await activeStatus.getAttribute('data-renderer-fallback')
      if (effective === 'webgl' || (effective === 'dom' && fallback !== 'none')) break
      if (Date.now() >= statusDeadline) throw new Error('active terminal never reached a semantic renderer state')
      await delay(50)
    }
    await window.locator('[aria-label="Close Settings"]').click()
  }
  await window.locator('[data-testid="settings-button"]').click()
  await window.locator('[data-testid="settings-tab-diagnostics"]').click()
  const rows = window.locator('[data-renderer-terminal-id]')
  const deadline = Date.now() + 10_000
  while (
    await rows.count() !== terminalIds.length
    || !await rows.evaluateAll(elements => elements.every(element =>
      element.getAttribute('data-renderer-effective') !== 'unavailable'
    ))
  ) {
    if (Date.now() >= deadline) throw new Error('renderer diagnostics did not match live terminal count')
    await delay(50)
  }
  const statuses = await rows.evaluateAll(elements => elements.map(element => ({
    terminalId: element.getAttribute('data-renderer-terminal-id'),
    effective: element.getAttribute('data-renderer-effective'),
    fallbackReason: element.getAttribute('data-renderer-fallback'),
  })))
  await window.locator('[aria-label="Close Settings"]').click()
  return statuses
}

async function verifyRendererStatusCleanup(window, terminalIds) {
  const closedTerminalId = terminalIds.at(-1)
  if (!closedTerminalId) throw new Error('renderer cleanup requires a live terminal')
  await window.locator(
    `[data-terminal-id="${closedTerminalId}"] [aria-label="Close terminal"]`,
  ).click()

  const expectedLiveCount = terminalIds.length - 1
  const paneDeadline = Date.now() + 10_000
  while (await window.locator('[data-terminal-id]').count() !== expectedLiveCount) {
    if (Date.now() >= paneDeadline) throw new Error('closed terminal pane did not leave the live set')
    await delay(50)
  }

  await window.locator('[data-testid="settings-button"]').click()
  await window.locator('[data-testid="settings-tab-diagnostics"]').click()
  const rows = window.locator('[data-renderer-terminal-id]')
  const statusDeadline = Date.now() + 10_000
  while (await rows.count() !== expectedLiveCount) {
    if (Date.now() >= statusDeadline) throw new Error('renderer status did not clean up after terminal close')
    await delay(50)
  }
  if (await window.locator(`[data-renderer-terminal-id="${closedTerminalId}"]`).count() !== 0) {
    throw new Error('closed terminal retained a renderer status')
  }
  const remainingTerminalIds = await rows.evaluateAll(elements =>
    elements.map(element => element.getAttribute('data-renderer-terminal-id')).filter(Boolean)
  )
  await window.locator('[aria-label="Close Settings"]').click()
  return { closedTerminalId, expectedLiveCount, remainingTerminalIds, ok: true }
}

async function installStreamProbe(window) {
  await window.evaluate(() => {
    const probe = { streams: {}, expectedMarkers: {}, markerSeen: {}, tails: {} }
    const unsubscribe = window.electron.terminal.onOutput(payload => {
      if (!('sequence' in payload)) return
      const current = probe.streams[payload.terminalId] ?? {
        firstSequence: payload.sequence,
        lastSequence: payload.sequence,
        chunks: 0,
        gaps: 0,
        duplicates: 0,
        epochs: [],
      }
      if (current.chunks > 0) {
        if (payload.sequence <= current.lastSequence) current.duplicates += 1
        else if (payload.sequence > current.lastSequence + 1) current.gaps += payload.sequence - current.lastSequence - 1
      }
      current.lastSequence = Math.max(current.lastSequence, payload.sequence)
      current.chunks += 1
      if (!current.epochs.includes(payload.streamEpoch)) current.epochs.push(payload.streamEpoch)
      probe.streams[payload.terminalId] = current
      const expected = probe.expectedMarkers[payload.terminalId]
      if (expected) {
        const candidate = `${probe.tails[payload.terminalId] ?? ''}${payload.data}`
        if (candidate.includes(expected)) probe.markerSeen[payload.terminalId] = true
        probe.tails[payload.terminalId] = candidate.slice(-(expected.length - 1))
      }
    })
    window.__MC_PACKAGED_SOAK__ = { probe, unsubscribe }
  })
}

async function waitForTerminalStreams(window, terminalIds) {
  const deadline = Date.now() + 10_000
  while (Date.now() < deadline) {
    const ready = await window.evaluate(ids => ids.every(id =>
      (window.__MC_PACKAGED_SOAK__.probe.streams[id]?.chunks ?? 0) > 0
    ), terminalIds)
    if (ready) return
    await delay(50)
  }
  throw new Error('terminal shells did not emit startup output')
}

async function waitForCanonicalMarker(window, terminalId, marker) {
  const deadline = Date.now() + MARKER_TIMEOUT_MS
  while (Date.now() < deadline) {
    const evidence = await window.evaluate(async ({ id, expected }) => {
      const snapshot = await window.electron.terminal.getSnapshot(id)
      if (!('ansi' in snapshot) || !snapshot.ansi.includes(expected)) return null
      return {
        bytes: new TextEncoder().encode(snapshot.ansi).byteLength,
        watermark: snapshot.watermark,
      }
    }, { id: terminalId, expected: marker })
    if (evidence) return evidence
    await delay(50)
  }
  return null
}

async function waitForLiveMarker(window, terminalId) {
  const deadline = Date.now() + MARKER_TIMEOUT_MS
  while (Date.now() < deadline) {
    const present = await window.evaluate(id =>
      window.__MC_PACKAGED_SOAK__.probe.markerSeen[id] === true
    , terminalId)
    if (present) return true
    await delay(50)
  }
  return false
}

async function sampleProcessMetrics(app, elapsedMs) {
  return app.evaluate(({ app: electronApp }, recordedAtMs) => electronApp.getAppMetrics().map(metric => ({
    recordedAtMs,
    pid: metric.pid,
    type: metric.type,
    workingSetMiB: metric.memory.workingSetSize / 1024,
    cpuPercent: metric.cpu.percentCPUUsage,
  })), elapsedMs)
}

async function sampleMemoryAttribution(app, canonical, terminalCount, recordedAtMs) {
  const main = await app.evaluate(async () => {
    const memory = await process.getProcessMemoryInfo()
    const heap = process.getHeapStatistics()
    return {
      privateMiB: memory.private / 1024,
      sharedMiB: memory.shared / 1024,
      heapUsedMiB: heap.usedHeapSize / 1024,
      heapTotalMiB: heap.totalHeapSize / 1024,
    }
  })

  return {
    recordedAtMs,
    mainPrivateMiB: main.privateMiB,
    mainSharedMiB: main.sharedMiB,
    mainHeapUsedMiB: main.heapUsedMiB,
    mainHeapTotalMiB: main.heapTotalMiB,
    canonicalBytes: canonical.bytes,
    canonicalWatermark: canonical.watermark,
    terminalCount,
  }
}

async function runPaneConfiguration({
  paneCount,
  durationSeconds,
  sampleIntervalMs,
  canonicalIntervalSeconds,
  executablePath,
  rendererPolicy,
  requestedProfileDirectory,
  settingsOperation,
}) {
  const profilePlan = createProfileDirectoryPlan({
    profileDirectory: requestedProfileDirectory,
    paneCount,
    makeTemporaryDirectory: prefix => fs.mkdtempSync(path.join(os.tmpdir(), prefix)),
  })
  const profileDirectory = profilePlan.profileDirectory
  fs.mkdirSync(profileDirectory, { recursive: true })
  let app

  try {
    app = await electron.launch({
      executablePath,
      args: ['--no-sandbox', '--e2e', `--user-data-dir=${profileDirectory}`],
      env: {
        ...process.env,
        NODE_ENV: 'test',
        ELECTRON_DISABLE_SANDBOX: '1',
        MULTICLAUDE_TEST_STORE_PATH: profileDirectory,
      },
    })
    const runtime = await app.evaluate(({ app: electronApp }) => ({
      appVersion: electronApp.getVersion(),
      isPackaged: electronApp.isPackaged,
    }))
    const window = app.windows()[0] ?? await app.firstWindow({ timeout: 10_000 })
    await window.waitForLoadState('domcontentloaded')
    await window.waitForSelector('#root', { state: 'attached', timeout: 10_000 })
    await delay(300)
    const settingsEvidence = await prepareSettings(window, rendererPolicy, settingsOperation)
    if (settingsOperation !== null) {
      return {
        paneCount,
        runtime,
        settingsOnly: true,
        settingsEvidence,
      }
    }
    if (settingsOperation !== 'observe') {
      await window.reload()
      await window.waitForLoadState('domcontentloaded')
      await window.waitForSelector('#root', { state: 'attached', timeout: 10_000 })
      await delay(300)
    }
    await installSoakProject(window, profileDirectory)
    await installStreamProbe(window)

    for (let index = 0; index < paneCount; index += 1) await addTerminal(window)
    const terminalIds = await window.locator('[data-terminal-id]').evaluateAll(elements =>
      elements.map(element => element.getAttribute('data-terminal-id')).filter(Boolean)
    )
    if (terminalIds.length !== paneCount) {
      throw new Error(`expected ${paneCount} terminals, found ${terminalIds.length}`)
    }
    await waitForTerminalStreams(window, terminalIds)
    const rendererStatuses = await collectRendererEvidence(window, terminalIds)
    const rendererEvidence = validateRendererEvidence({
      terminalIds,
      statuses: rendererStatuses,
      policy: rendererPolicy,
    })
    if (!rendererEvidence.ok) {
      throw new Error(`renderer evidence failed: ${rendererEvidence.failures.join('; ')}`)
    }

    const startedAt = Date.now()
    const deadline = startedAt + durationSeconds * 1_000
    const processSamples = []
    const attributionSamples = []
    const finalMarkers = {}
    const canonicalByTerminal = {}
    let lastCanonicalCheckAt = 0
    let canonicalChecks = 0
    let cycles = 0

    while (Date.now() < deadline || cycles === 0) {
      cycles += 1
      const markers = Object.fromEntries(terminalIds.map((terminalId, index) => [
        terminalId,
        `MC_SOAK_P${paneCount}_C${cycles}_T${index}_${Date.now()}`,
      ]))
      const wide = cycles % 2 === 1

      await window.evaluate(({ ids, markerMap, commandMap, cols, rows }) => {
        for (const id of ids) {
          window.__MC_PACKAGED_SOAK__.probe.expectedMarkers[id] = markerMap[id]
          window.__MC_PACKAGED_SOAK__.probe.markerSeen[id] = false
          window.__MC_PACKAGED_SOAK__.probe.tails[id] = ''
          window.electron.terminal.resize(id, cols, rows)
          window.electron.terminal.write(id, commandMap[id])
        }
      }, {
        ids: terminalIds,
        markerMap: markers,
        commandMap: Object.fromEntries(Object.entries(markers).map(([id, marker]) => [id, workloadCommand(marker)])),
        cols: wide ? 100 : 80,
        rows: wide ? 30 : 24,
      })

      const shouldCheckCanonical = canonicalIntervalSeconds === 0
        || cycles === 1
        || Date.now() - lastCanonicalCheckAt >= canonicalIntervalSeconds * 1_000
      if (shouldCheckCanonical) {
        lastCanonicalCheckAt = Date.now()
        canonicalChecks += 1
      }
      const markerResults = await Promise.all(terminalIds.map(async terminalId => {
        const [live, canonical] = await Promise.all([
          waitForLiveMarker(window, terminalId),
          shouldCheckCanonical
            ? waitForCanonicalMarker(window, terminalId, markers[terminalId])
            : Promise.resolve(canonicalByTerminal[terminalId]),
        ])
        return { live, canonical }
      }))
      for (let index = 0; index < terminalIds.length; index += 1) {
        if (!markerResults[index].live || !markerResults[index].canonical) {
          const diagnostic = await window.evaluate(async id => {
            const snapshot = await window.electron.terminal.getSnapshot(id)
            return {
              streamMarkerSeen: window.__MC_PACKAGED_SOAK__.probe.markerSeen[id] === true,
              snapshotHasSoakPrefix: 'ansi' in snapshot && snapshot.ansi.includes('MC_SOAK'),
              stream: window.__MC_PACKAGED_SOAK__.probe.streams[id] ?? null,
            }
          }, terminalIds[index])
          throw new Error(`${terminalIds[index]} did not deliver and commit cycle ${cycles} marker (${JSON.stringify({
            liveMarkerPresent: markerResults[index].live,
            canonicalMarkerPresent: markerResults[index].canonical,
            ...diagnostic,
          })})`)
        }
        if (shouldCheckCanonical) canonicalByTerminal[terminalIds[index]] = markerResults[index].canonical
        finalMarkers[terminalIds[index]] = markers[terminalIds[index]]
      }

      const recordedAtMs = Date.now() - startedAt
      const canonical = aggregateCanonicalEvidence(markerResults)
      const [processMetrics, attribution] = await Promise.all([
        sampleProcessMetrics(app, recordedAtMs),
        sampleMemoryAttribution(app, canonical, terminalIds.length, recordedAtMs),
      ])
      processSamples.push(...processMetrics)
      validateAttributionSample(attribution)
      attributionSamples.push(attribution)
      process.stderr.write(`[packaged-soak] panes=${paneCount} cycle=${cycles} elapsed=${Math.round((Date.now() - startedAt) / 1000)}s\n`)
      const remainingMs = deadline - Date.now()
      if (remainingMs > 0) await delay(Math.min(sampleIntervalMs, remainingMs))
    }

    const canonicalMarkers = Object.fromEntries(await Promise.all(terminalIds.map(async terminalId => [
      terminalId,
      Boolean(await waitForCanonicalMarker(window, terminalId, finalMarkers[terminalId])),
    ])))
    const liveMarkers = await window.evaluate(ids => Object.fromEntries(ids.map(id => [
      id,
      window.__MC_PACKAGED_SOAK__.probe.markerSeen[id] === true,
    ])), terminalIds)
    const streams = await window.evaluate(() => window.__MC_PACKAGED_SOAK__.probe.streams)
    const evidence = validateTerminalEvidence({ terminalIds, streams, liveMarkers, canonicalMarkers })
    if (!evidence.ok) throw new Error(`terminal correctness evidence failed: ${evidence.failures.join('; ')}`)
    const rendererCleanup = await verifyRendererStatusCleanup(window, terminalIds)

    return {
      paneCount,
      runtime,
      requestedDurationSeconds: durationSeconds,
      elapsedSeconds: Number(((Date.now() - startedAt) / 1000).toFixed(2)),
      cycles,
      canonicalChecks,
      terminalEvidence: { terminalIds, streams, liveMarkers, canonicalMarkers, ok: true },
      rendererEvidence: {
        policy: rendererPolicy,
        statuses: rendererStatuses,
        cleanup: rendererCleanup,
        ok: true,
      },
      settingsEvidence,
      processMetrics: summarizeProcessSamples(processSamples),
      memoryAttribution: summarizeAttributionSamples(attributionSamples),
      rawProcessSamples: processSamples,
      rawAttributionSamples: attributionSamples,
    }
  } finally {
    if (app) await closeElectronApp(app)
    if (profilePlan.cleanup) fs.rmSync(profileDirectory, { recursive: true, force: true })
  }
}

async function main() {
  const runStartedAt = new Date().toISOString()
  const options = parseSoakArguments(process.argv.slice(2))
  const executablePath = path.resolve(readSingleFlag(process.argv.slice(2), 'executable', DEFAULT_EXECUTABLE))
  const outputPath = readSingleFlag(process.argv.slice(2), 'output', '')
  if (!fs.existsSync(executablePath)) throw new Error(`packaged executable not found: ${executablePath}`)
  const appArchivePath = path.resolve(path.dirname(executablePath), '../Resources/app.asar')

  const results = []
  const buildDocument = (failure = null) => ({
    environment: {
      platform: process.platform,
      arch: process.arch,
      osRelease: os.release(),
      cpuModel: os.cpus()[0]?.model ?? 'unknown',
      totalMemoryGiB: Number((os.totalmem() / 1024 / 1024 / 1024).toFixed(2)),
      executablePath: evidenceExecutableIdentifier(executablePath, process.cwd()),
      executableSha256: sha256File(executablePath),
      appArchiveSha256: fs.existsSync(appArchivePath) ? sha256File(appArchivePath) : null,
      appVersion: results[0]?.runtime.appVersion ?? null,
      isPackaged: results[0]?.runtime.isPackaged ?? null,
      runStartedAt,
      runCompletedAt: new Date().toISOString(),
      paneCounts: options.paneCounts,
      rendererPolicy: options.rendererPolicy,
      profileOwnership: options.profileDirectory ? 'caller' : 'runner',
      settingsOperation: options.settingsOperation ?? 'apply-policy',
      durationSecondsPerPaneCount: options.durationSeconds,
      sampleIntervalMs: options.sampleIntervalMs,
      canonicalIntervalSeconds: options.canonicalIntervalSeconds,
      markerTimeoutMs: MARKER_TIMEOUT_MS,
    },
    results,
    ...(failure ? { failure } : {}),
  })

  try {
    for (const paneCount of options.paneCounts) {
      results.push(await runPaneConfiguration({
        ...options,
        paneCount,
        executablePath,
        requestedProfileDirectory: options.profileDirectory,
      }))
      if (outputPath) writeJsonAtomic(outputPath, buildDocument())
    }
  } catch (error) {
    if (outputPath) {
      writeJsonAtomic(outputPath, buildDocument({ code: 'run-failed', failedAt: new Date().toISOString() }))
    }
    throw error
  }

  process.stdout.write(`${JSON.stringify(buildDocument(), null, 2)}\n`)
}

await main()
