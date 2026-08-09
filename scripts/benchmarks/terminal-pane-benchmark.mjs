import { performance } from 'node:perf_hooks'
import process from 'node:process'
import headlessPackage from '@xterm/headless'
import serializePackage from '@xterm/addon-serialize'

const { Terminal } = headlessPackage
const { SerializeAddon } = serializePackage

const PANE_COUNTS = [1, 4, 9]
const RESIZE_REPEATS = 10
const COLS = 80
const ROWS = 24
const SCROLLBACK = 20_000

function readFlag(name, fallback) {
  const raw = process.argv.find((argument) => argument.startsWith(`--${name}=`))
  if (!raw) return fallback
  const value = Number.parseInt(raw.slice(name.length + 3), 10)
  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(`--${name} must be a positive integer`)
  }
  return value
}

function writeAsync(terminal, data) {
  return new Promise((resolve) => terminal.write(data, resolve))
}

function quantile(values, fraction) {
  const sorted = [...values].sort((left, right) => left - right)
  return sorted[Math.max(0, Math.ceil(sorted.length * fraction) - 1)]
}

function round(value) {
  return Number(value.toFixed(2))
}

function summarize(values) {
  return {
    median: round(quantile(values, 0.5)),
    p95: round(quantile(values, 0.95))
  }
}

function buildPayload(lineCount) {
  const lines = []
  for (let index = 0; index < lineCount; index++) {
    const prefix = `MC_BENCH_${String(index).padStart(6, '0')}:`
    lines.push(`${prefix}${'x'.repeat(74 - prefix.length)}\r\n`)
  }
  return lines.join('')
}

function createTerminal() {
  const terminal = new Terminal({
    cols: COLS,
    rows: ROWS,
    scrollback: SCROLLBACK,
    allowProposedApi: true
  })
  const serializer = new SerializeAddon()
  terminal.loadAddon(serializer)
  return { terminal, serializer }
}

async function runSample(paneCount, payload, lastMarker) {
  globalThis.gc?.()
  const rssBefore = process.memoryUsage().rss
  const cpuBefore = process.cpuUsage()
  const panes = Array.from({ length: paneCount }, createTerminal)

  const writeStartedAt = performance.now()
  await Promise.all(panes.map(({ terminal }) => writeAsync(terminal, payload)))
  const writeMs = performance.now() - writeStartedAt

  const resizeSamples = []
  for (let index = 0; index < RESIZE_REPEATS; index++) {
    const resizeStartedAt = performance.now()
    const cols = index % 2 === 0 ? 100 : COLS
    const rows = index % 2 === 0 ? 30 : ROWS
    for (const { terminal } of panes) terminal.resize(cols, rows)
    resizeSamples.push(performance.now() - resizeStartedAt)
  }

  const serializeStartedAt = performance.now()
  const snapshots = panes.map(({ serializer }) => serializer.serialize())
  const serializeMs = performance.now() - serializeStartedAt

  const resumeStartedAt = performance.now()
  const restoredPanes = snapshots.map(() => createTerminal())
  await Promise.all(restoredPanes.map(({ terminal }, index) =>
    writeAsync(terminal, snapshots[index])
  ))
  const resumeMs = performance.now() - resumeStartedAt
  const everySnapshotRestored = restoredPanes.every(({ serializer }) =>
    serializer.serialize().includes(lastMarker)
  )

  const rssAfter = process.memoryUsage().rss
  const cpu = process.cpuUsage(cpuBefore)
  const payloadBytes = Buffer.byteLength(payload) * paneCount

  for (const { terminal } of restoredPanes) terminal.dispose()
  for (const { terminal } of panes) terminal.dispose()

  return {
    rssDeltaMiB: (rssAfter - rssBefore) / 1024 / 1024,
    writeMs,
    throughputMiBPerSecond: payloadBytes / 1024 / 1024 / (writeMs / 1000),
    resizeMs: resizeSamples,
    serializeMs,
    resumeMs,
    cpuUserMs: cpu.user / 1000,
    cpuSystemMs: cpu.system / 1000,
    restoredLastMarker: everySnapshotRestored
  }
}

async function main() {
  const lineCount = readFlag('lines', 10_000)
  const repeats = readFlag('repeats', 3)
  const payload = buildPayload(lineCount)
  const lastMarker = `MC_BENCH_${String(lineCount - 1).padStart(6, '0')}`
  const results = []

  for (const paneCount of PANE_COUNTS) {
    const samples = []
    for (let repeat = 0; repeat < repeats; repeat++) {
      samples.push(await runSample(paneCount, payload, lastMarker))
    }

    results.push({
      panes: paneCount,
      rssDeltaMiB: summarize(samples.map((sample) => sample.rssDeltaMiB)),
      writeMs: summarize(samples.map((sample) => sample.writeMs)),
      throughputMiBPerSecond: summarize(samples.map((sample) => sample.throughputMiBPerSecond)),
      resizeMs: summarize(samples.flatMap((sample) => sample.resizeMs)),
      serializeMs: summarize(samples.map((sample) => sample.serializeMs)),
      resumeMs: summarize(samples.map((sample) => sample.resumeMs)),
      cpuUserMs: summarize(samples.map((sample) => sample.cpuUserMs)),
      cpuSystemMs: summarize(samples.map((sample) => sample.cpuSystemMs)),
      restoredLastMarker: samples.every((sample) => sample.restoredLastMarker)
    })
  }

  process.stdout.write(`${JSON.stringify({
    environment: {
      platform: process.platform,
      arch: process.arch,
      node: process.version,
      paneCounts: PANE_COUNTS,
      lineCount,
      payloadBytesPerPane: Buffer.byteLength(payload),
      repeats,
      resizeRepeats: RESIZE_REPEATS,
      cols: COLS,
      rows: ROWS,
      scrollback: SCROLLBACK,
      exposedGc: typeof globalThis.gc === 'function'
    },
    results
  }, null, 2)}\n`)
}

await main()
