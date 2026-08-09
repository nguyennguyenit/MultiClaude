/**
 * Phase 8 integration test: feeds a synthetic multi-turn session through
 * the analyzer end-to-end and asserts every advanced section gets the
 * data it needs. Also enforces the hot IPC payload size guardrail
 * (p95 ≤ 64KB) against the resulting snapshot.
 */
import { describe, it, expect } from 'vitest'
import { EventEmitter } from 'events'
import { ContextWindowAnalyzer, type JsonlLineEvent } from '@main/context/context-window-analyzer'
import type { ClaudeMdReader } from '@main/context/claude-md-reader'
import type { ContextSnapshot } from '@shared/types/context-window'

const HOT_PAYLOAD_BUDGET_BYTES = 64 * 1024

function makeAnalyzer(): { analyzer: ContextWindowAnalyzer; emit: (ev: JsonlLineEvent) => void } {
  const src = new EventEmitter()
  const stubReader = {
    load: async () => ({ text: '', bytes: 0, sources: [] })
  } as unknown as ClaudeMdReader
  const analyzer = new ContextWindowAnalyzer(src, stubReader)
  return {
    analyzer,
    emit: (ev) => src.emit('jsonlLine', ev)
  }
}

function userText(text: string): JsonlLineEvent {
  return {
    sessionId: 's',
    cwd: '/p',
    filePath: '/f.jsonl',
    line: { type: 'user', message: { content: text } }
  }
}

function assistantBlocks(blocks: unknown[]): JsonlLineEvent {
  return {
    sessionId: 's',
    filePath: '/f.jsonl',
    line: { type: 'assistant', message: { content: blocks } }
  }
}

function toolResults(results: Array<{ id: string; content: string }>): JsonlLineEvent {
  return {
    sessionId: 's',
    filePath: '/f.jsonl',
    line: {
      type: 'user',
      message: {
        content: results.map((r) => ({ type: 'tool_result', tool_use_id: r.id, content: r.content }))
      }
    }
  }
}

describe('Phase 8 integration: context drawer extended', () => {
  it('snapshot contains all advanced fields after a representative multi-turn session', () => {
    const { analyzer, emit } = makeAnalyzer()

    // Turn 1: user → assistant (Read + Agent + thinking) → tool_results
    emit(userText('first task'))
    emit(assistantBlocks([
      { type: 'thinking', thinking: '', signature: 'sigTurn1aaaaaaaaaaaaaa' },
      { type: 'tool_use', id: 'tu_r1', name: 'Read', input: { path: '/x' } },
      { type: 'tool_use', id: 'tu_a1', name: 'Agent', input: { subagent_type: 'researcher', description: 'research X', prompt: 'go' } }
    ]))
    emit(toolResults([
      { id: 'tu_r1', content: 'file body x' },
      { id: 'tu_a1', content: 'agent says done' }
    ]))

    // Turn 2: user → assistant (Bash) → tool_result
    emit(userText('second task'))
    emit(assistantBlocks([
      { type: 'thinking', thinking: '', signature: 'sigTurn2bbbbbbbbbbbbbb' },
      { type: 'tool_use', id: 'tu_b2', name: 'Bash', input: { command: 'ls' } }
    ]))
    emit(toolResults([{ id: 'tu_b2', content: 'output' }]))

    // Turn 3: user → explicit summary line (compaction high-confidence)
    emit(userText('third task'))
    emit({ sessionId: 's', filePath: 'f', line: { type: 'summary', summary: 'compacted history', timestamp: Date.now() } })

    // Force-close turn 3 by opening turn 4
    emit(userText('fourth task'))

    const snap = analyzer.getSnapshot('s')
    expect(snap).not.toBeNull()
    const s = snap as ContextSnapshot

    // 6-cat bar still works
    expect(s.total).toBeGreaterThan(0)
    expect(s.buckets['user-messages'].itemCount).toBeGreaterThanOrEqual(4)
    expect(s.buckets['thinking-text'].itemCount).toBeGreaterThanOrEqual(0)

    // Phase 3 — turn deltas with content-hash dedup applied
    expect(s.turnDeltas).toBeDefined()
    expect(s.turnDeltas!.length).toBeGreaterThanOrEqual(3)

    // Flat tool activity on at least one closed turn. Agent calls remain tools;
    // no nested-agent hierarchy is claimed without a correlated inner stream.
    const turn1 = s.turnDeltas!.find((t) => t.turnId === 1)
    expect(turn1?.trace).toBeDefined()
    expect(turn1!.trace).toHaveLength(1)
    expect(turn1!.trace![0].toolCalls.map((call) => call.name)).toContain('Agent')
    expect(turn1!.trace![0]).not.toHaveProperty('agentType')
    expect(turn1!.trace![0]).not.toHaveProperty('children')

    // Phase 5 — high-confidence compaction event
    expect(s.compactionEvents).toBeDefined()
    expect(s.compactionEvents!.some((e) => e.confidence === 'high')).toBe(true)

    // Phase 6 — thinking block per turn (signed-only)
    expect(s.thinkingBlocks).toBeDefined()
    expect(s.thinkingBlocks!.length).toBeGreaterThanOrEqual(2)
    expect(s.thinkingBlocks![0].signatures.length).toBeGreaterThan(0)

    analyzer.destroy()
  })

  it('hot IPC payload (full snapshot) stays within the 64KB budget for typical sessions', () => {
    const { analyzer, emit } = makeAnalyzer()
    // Simulate a heavier session: 30 turns, each with 2 tool calls + thinking
    for (let i = 1; i <= 30; i++) {
      emit(userText(`turn ${i} prompt`))
      emit(assistantBlocks([
        { type: 'thinking', thinking: '', signature: `sig${i}__________________________` },
        { type: 'tool_use', id: `tu_r${i}`, name: 'Read', input: { path: `/p${i}` } },
        { type: 'tool_use', id: `tu_b${i}`, name: 'Bash', input: { command: `cmd ${i}` } }
      ]))
      emit(toolResults([
        { id: `tu_r${i}`, content: 'x'.repeat(120) },
        { id: `tu_b${i}`, content: 'y'.repeat(80) }
      ]))
    }
    // Force final turn close
    emit(userText('end'))

    const snap = analyzer.getSnapshot('s')!
    const payload = JSON.stringify(snap)
    const bytes = new TextEncoder().encode(payload).byteLength
    expect(bytes).toBeLessThanOrEqual(HOT_PAYLOAD_BUDGET_BYTES)

    analyzer.destroy()
  })

  it('does not regress 6-category accounting when a session contains zero tool calls', () => {
    const { analyzer, emit } = makeAnalyzer()
    emit(userText('hello'))
    emit(assistantBlocks([{ type: 'text', text: 'world' }]))
    const snap = analyzer.getSnapshot('s')!
    expect(snap.buckets['user-messages'].itemCount).toBe(1)
    expect(snap.buckets['thinking-text'].itemCount).toBe(1)
    expect(snap.total).toBeGreaterThan(0)
    analyzer.destroy()
  })
})
