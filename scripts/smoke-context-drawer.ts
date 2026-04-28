/**
 * Real-session smoke test for Context Drawer extended (Phase 2-6).
 *
 * Streams a real JSONL session through ContextWindowAnalyzer and prints
 * what each advanced section detected. This is the realism check the
 * synthetic unit tests can't give us.
 *
 * Run: npx tsx scripts/smoke-context-drawer.ts <path-to.jsonl>
 */
import { EventEmitter } from 'events'
import { readFileSync } from 'fs'
import { ContextWindowAnalyzer, type JsonlLineEvent } from '../src/main/context/context-window-analyzer'
import type { ClaudeMdReader } from '../src/main/context/claude-md-reader'

const path = process.argv[2]
if (!path) {
  console.error('usage: smoke-context-drawer.ts <session.jsonl>')
  process.exit(1)
}

const src = new EventEmitter()
const stubReader = {
  load: async () => ({ text: '', bytes: 0, sources: [] })
} as unknown as ClaudeMdReader
const analyzer = new ContextWindowAnalyzer(src, stubReader)

const raw = readFileSync(path, 'utf8')
const lines = raw.split('\n').filter(Boolean)
let parsedCount = 0
let badCount = 0
let firstSession: string | null = null

const t0 = Date.now()
for (const ln of lines) {
  let parsed: unknown
  try { parsed = JSON.parse(ln) } catch { badCount++; continue }
  parsedCount++
  const obj = parsed as Record<string, unknown>
  const sid = (obj.sessionId as string) ?? 'unknown'
  if (!firstSession) firstSession = sid
  const ev: JsonlLineEvent = {
    sessionId: sid,
    cwd: (obj.cwd as string) ?? undefined,
    filePath: path,
    line: parsed
  }
  src.emit('jsonlLine', ev)
}
// Force-close last open turn
if (firstSession) {
  src.emit('jsonlLine', {
    sessionId: firstSession,
    filePath: path,
    line: { type: 'user', message: { content: '__force_close_for_smoke__' } }
  } as JsonlLineEvent)
}
const elapsed = Date.now() - t0

const sid = firstSession!
const snap = analyzer.getSnapshot(sid)
if (!snap) {
  console.error('no snapshot produced')
  process.exit(2)
}

const ipcBytes = new TextEncoder().encode(JSON.stringify(snap)).byteLength

console.log('═══ Context Drawer real-session smoke ═══')
console.log(`file:           ${path.split('/').pop()}`)
console.log(`sessionId:      ${sid}`)
console.log(`lines parsed:   ${parsedCount}  (skipped: ${badCount})`)
console.log(`elapsed:        ${elapsed}ms`)
console.log()
console.log(`total tokens:   ${snap.total.toLocaleString()}`)
console.log(`6-cat buckets:`)
for (const [cat, b] of Object.entries(snap.buckets)) {
  console.log(`  ${cat.padEnd(20)} tokens=${String(b.tokens).padStart(7)}  items=${b.itemCount}`)
}

console.log()
console.log(`turnDeltas:     ${snap.turnDeltas?.length ?? 0} closed turns (cap 50)`)
if (snap.turnDeltas && snap.turnDeltas.length > 0) {
  const sum = snap.turnDeltas.reduce((a, t) => a + t.totalDelta, 0)
  const max = snap.turnDeltas.reduce((m, t) => Math.max(m, t.totalDelta), 0)
  const spikes = snap.turnDeltas.filter((t) => t.totalDelta >= 2000).length
  console.log(`  total delta sum=${sum.toLocaleString()}  max-turn=${max.toLocaleString()}  spikes(≥2k)=${spikes}`)
  console.log(`  last 3 turns:`)
  for (const t of snap.turnDeltas.slice(-3)) {
    const breakdown = Object.entries(t.perCategoryTokens)
      .filter(([, v]) => v > 0)
      .map(([k, v]) => `${k}=${v}`)
      .join(' ')
    console.log(`    #${t.turnId}  +${t.totalDelta} tokens  [${breakdown}]`)
  }
}

console.log()
const lastTrace = snap.turnDeltas?.slice(-5).find((t) => t.trace && t.trace.length > 0)?.trace
if (lastTrace) {
  console.log(`exec trace (most recent turn with activity):`)
  for (const node of lastTrace) {
    const detail = node.agentType === 'subagent'
      ? `name=${node.agentName}  desc="${node.description ?? ''}"`
      : `${node.toolCalls.length} tool calls`
    console.log(`  [${node.agentType}] ${detail}  tokens=${node.tokens}${node.depthCapped ? ' (capped+' + node.deeperCount + ')' : ''}`)
    if (node.agentType === 'main' && node.toolCalls.length > 0) {
      const counts = new Map<string, number>()
      for (const c of node.toolCalls) counts.set(c.name, (counts.get(c.name) ?? 0) + 1)
      const top = [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5).map(([n, c]) => `${n}×${c}`).join(', ')
      console.log(`         top tools: ${top}`)
    }
  }
} else {
  console.log(`exec trace:     no Agent/tool activity in last 5 turns`)
}

console.log()
console.log(`compaction:     ${snap.compactionEvents?.length ?? 0} events (cap 10)`)
if (snap.compactionEvents) {
  for (const e of snap.compactionEvents) {
    const t = new Date(e.timestamp).toISOString()
    console.log(`  [${e.confidence}] ${t}  ${e.beforeTokens.toLocaleString()} → ${e.afterTokens.toLocaleString()}`)
  }
}

console.log()
console.log(`thinking:       ${snap.thinkingBlocks?.length ?? 0} turns with thinking (cap 30)`)
if (snap.thinkingBlocks) {
  const totalSig = snap.thinkingBlocks.reduce((a, b) => a + b.count, 0)
  const totalTokens = snap.thinkingBlocks.reduce((a, b) => a + b.approxTokens, 0)
  console.log(`  total signed blocks=${totalSig}  approx tokens=${totalTokens}`)
}

console.log()
console.log(`hot IPC payload: ${(ipcBytes / 1024).toFixed(2)} KB  (budget 64 KB) ${ipcBytes <= 64 * 1024 ? '✓' : '✗ OVER'}`)

analyzer.destroy()
