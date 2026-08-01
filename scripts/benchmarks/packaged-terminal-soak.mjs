import fs from 'node:fs'
import { createHash } from 'node:crypto'
import os from 'node:os'
import path from 'node:path'
import process from 'node:process'
import { _electron as electron } from '@playwright/test'

import {
  aggregateCanonicalEvidence,
  parseSoakArguments,
  readSingleFlag,
  summarizeAttributionSamples,
  summarizeProcessSamples,
  validateAttributionSample,
  validateTerminalEvidence,
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
}) {
  const profileDirectory = fs.mkdtempSync(path.join(os.tmpdir(), `multiclaude-packaged-soak-${paneCount}-`))
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

    return {
      paneCount,
      runtime,
      requestedDurationSeconds: durationSeconds,
      elapsedSeconds: Number(((Date.now() - startedAt) / 1000).toFixed(2)),
      cycles,
      canonicalChecks,
      terminalEvidence: { terminalIds, streams, liveMarkers, canonicalMarkers, ok: true },
      processMetrics: summarizeProcessSamples(processSamples),
      memoryAttribution: summarizeAttributionSamples(attributionSamples),
      rawProcessSamples: processSamples,
      rawAttributionSamples: attributionSamples,
    }
  } finally {
    if (app) await closeElectronApp(app)
    fs.rmSync(profileDirectory, { recursive: true, force: true })
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
      executablePath: path.relative(process.cwd(), executablePath),
      executableSha256: sha256File(executablePath),
      appArchiveSha256: fs.existsSync(appArchivePath) ? sha256File(appArchivePath) : null,
      appVersion: results[0]?.runtime.appVersion ?? null,
      isPackaged: results[0]?.runtime.isPackaged ?? null,
      runStartedAt,
      runCompletedAt: new Date().toISOString(),
      paneCounts: options.paneCounts,
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
      results.push(await runPaneConfiguration({ ...options, paneCount, executablePath }))
      if (outputPath) writeJsonAtomic(outputPath, buildDocument())
    }
  } catch (error) {
    if (outputPath) {
      writeJsonAtomic(outputPath, buildDocument({
        message: error instanceof Error ? error.message : String(error),
        failedAt: new Date().toISOString(),
      }))
    }
    throw error
  }

  process.stdout.write(`${JSON.stringify(buildDocument(), null, 2)}\n`)
}

await main()
