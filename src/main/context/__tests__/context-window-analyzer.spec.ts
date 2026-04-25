import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { EventEmitter } from 'events'
import { ContextWindowAnalyzer, type JsonlLineEvent } from '../context-window-analyzer'
import { ClaudeMdReader } from '../claude-md-reader'

function makeSource() {
  const src = new EventEmitter()
  return {
    source: src,
    emit: (ev: JsonlLineEvent) => src.emit('jsonlLine', ev)
  }
}

describe('ContextWindowAnalyzer', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => {
    vi.useRealTimers()
  })

  it('accumulates buckets across lines', () => {
    const { source, emit } = makeSource()
    const stubReader = { load: async () => ({ text: '', bytes: 0, sources: [] }) } as unknown as ClaudeMdReader
    const a = new ContextWindowAnalyzer(source, stubReader)
    emit({
      sessionId: 's1', cwd: '/p', filePath: '/f.jsonl',
      line: { type: 'user', message: { content: 'hello' } }
    })
    emit({
      sessionId: 's1', cwd: '/p', filePath: '/f.jsonl',
      line: { type: 'assistant', message: { content: [{ type: 'thinking', thinking: 'pondering deeply' }] } }
    })
    const snap = a.getSnapshot('s1')
    expect(snap).not.toBeNull()
    expect(snap!.buckets['user-messages'].itemCount).toBe(1)
    expect(snap!.buckets['thinking-text'].itemCount).toBe(1)
    expect(snap!.total).toBeGreaterThan(0)
    a.destroy()
  })

  it('debounces snapshot emits at 300ms', () => {
    const { source, emit } = makeSource()
    const stubReader = { load: async () => ({ text: '', bytes: 0, sources: [] }) } as unknown as ClaudeMdReader
    const a = new ContextWindowAnalyzer(source, stubReader)
    const spy = vi.fn()
    a.on('snapshot', spy)

    for (let i = 0; i < 5; i++) {
      emit({ sessionId: 's', filePath: 'f', line: { type: 'user', message: { content: `msg${i}` } } })
    }
    expect(spy).not.toHaveBeenCalled()
    vi.advanceTimersByTime(100)
    expect(spy).not.toHaveBeenCalled()
    vi.advanceTimersByTime(300)
    expect(spy).toHaveBeenCalledTimes(1)
    a.destroy()
  })

  it('returns null snapshot for unknown session', () => {
    const { source } = makeSource()
    const a = new ContextWindowAnalyzer(source, { load: async () => ({ text: '', bytes: 0, sources: [] }) } as ClaudeMdReader)
    expect(a.getSnapshot('nope')).toBeNull()
    a.destroy()
  })

  it('swallows categorizer errors and emits a single error event per session', () => {
    const { source, emit } = makeSource()
    const stubReader = { load: async () => ({ text: '', bytes: 0, sources: [] }) } as unknown as ClaudeMdReader
    const a = new ContextWindowAnalyzer(source, stubReader)
    const errSpy = vi.fn()
    a.on('error', errSpy)

    // Two lines crafted to make categorizer throw: `message` getter explodes.
    const boomLine = Object.defineProperty({ type: 'user' } as Record<string, unknown>, 'message', {
      get() { throw new Error('boom') },
      enumerable: true
    })

    expect(() => {
      emit({ sessionId: 's-err', filePath: 'f', line: boomLine })
      emit({ sessionId: 's-err', filePath: 'f', line: boomLine })
    }).not.toThrow()

    expect(errSpy).toHaveBeenCalledTimes(1)
    expect(errSpy.mock.calls[0][0]).toBeInstanceOf(Error)
    a.destroy()
  })

  it('tracks per-turn deltas: each fresh user-text line opens a new turn', () => {
    const { source, emit } = makeSource()
    const stubReader = { load: async () => ({ text: '', bytes: 0, sources: [] }) } as unknown as ClaudeMdReader
    const a = new ContextWindowAnalyzer(source, stubReader)

    // Turn 1
    emit({ sessionId: 's', filePath: 'f', line: { type: 'user', message: { content: 'first question' } } })
    emit({ sessionId: 's', filePath: 'f', line: { type: 'assistant', message: { content: [{ type: 'thinking', thinking: 'thinking-1' }] } } })
    // Turn 2 (new user text)
    emit({ sessionId: 's', filePath: 'f', line: { type: 'user', message: { content: 'second question' } } })
    emit({ sessionId: 's', filePath: 'f', line: { type: 'assistant', message: { content: [{ type: 'thinking', thinking: 'thinking-2' }] } } })

    // Flush turn-2 close by emitting an unrelated user line — but easier: query getTurnDetail after turn 2 closes.
    // Turn 2 hasn't been closed yet (no third user line). Force close by starting turn 3.
    emit({ sessionId: 's', filePath: 'f', line: { type: 'user', message: { content: 'third question' } } })

    const snap = a.getSnapshot('s')
    expect(snap?.turnDeltas).toBeDefined()
    expect(snap!.turnDeltas!.length).toBe(2)
    expect(snap!.turnDeltas![0].turnId).toBe(1)
    expect(snap!.turnDeltas![1].turnId).toBe(2)
    expect(snap!.turnDeltas![0].totalDelta).toBeGreaterThan(0)
    expect(a.getTurnDetail('s', 1)).not.toBeNull()
    a.destroy()
  })

  it('records explicit compaction event from a summary line', () => {
    const { source, emit } = makeSource()
    const stubReader = { load: async () => ({ text: '', bytes: 0, sources: [] }) } as unknown as ClaudeMdReader
    const a = new ContextWindowAnalyzer(source, stubReader)

    emit({ sessionId: 's', filePath: 'f', line: { type: 'user', message: { content: 'lots of context' } } })
    emit({ sessionId: 's', filePath: 'f', line: { type: 'summary', summary: 'compact summary text', timestamp: Date.now() } })

    const snap = a.getSnapshot('s')
    expect(snap?.compactionEvents).toBeDefined()
    expect(snap!.compactionEvents!.length).toBe(1)
    expect(snap!.compactionEvents![0].confidence).toBe('high')
    a.destroy()
  })

  it('attaches execution trace to closed-turn summary', () => {
    const { source, emit } = makeSource()
    const stubReader = { load: async () => ({ text: '', bytes: 0, sources: [] }) } as unknown as ClaudeMdReader
    const a = new ContextWindowAnalyzer(source, stubReader)

    // Turn 1 with Agent + main tool
    emit({ sessionId: 's', filePath: 'f', line: { type: 'user', message: { content: 'turn one' } } })
    emit({
      sessionId: 's', filePath: 'f',
      line: {
        type: 'assistant',
        message: {
          content: [
            { type: 'tool_use', id: 'tu_r', name: 'Read', input: { path: '/x' } },
            { type: 'tool_use', id: 'tu_a', name: 'Agent', input: { subagent_type: 'tester', description: 'run tests' } }
          ]
        }
      }
    })
    emit({
      sessionId: 's', filePath: 'f',
      line: {
        type: 'user',
        message: {
          content: [
            { type: 'tool_result', tool_use_id: 'tu_r', content: 'file' },
            { type: 'tool_result', tool_use_id: 'tu_a', content: 'tests passed' }
          ]
        }
      }
    })

    // Force close via new turn
    emit({ sessionId: 's', filePath: 'f', line: { type: 'user', message: { content: 'turn two' } } })

    const snap = a.getSnapshot('s')
    const turn1 = snap?.turnDeltas?.find((t) => t.turnId === 1)
    expect(turn1?.trace).toBeDefined()
    expect(turn1!.trace!.length).toBe(2)
    const main = turn1!.trace!.find((n) => n.agentType === 'main')
    const sub = turn1!.trace!.find((n) => n.agentType === 'subagent')
    expect(main?.toolCalls.length).toBe(1)
    expect(main?.toolCalls[0].name).toBe('Read')
    expect(sub?.agentName).toBe('tester')
    a.destroy()
  })

  it('does not bump turn counter on system-reminder user lines', () => {
    const { source, emit } = makeSource()
    const stubReader = { load: async () => ({ text: '', bytes: 0, sources: [] }) } as unknown as ClaudeMdReader
    const a = new ContextWindowAnalyzer(source, stubReader)

    emit({ sessionId: 's', filePath: 'f', line: { type: 'user', message: { content: 'real question' } } })
    emit({ sessionId: 's', filePath: 'f', line: { type: 'user', message: { content: '<system-reminder>injected</system-reminder>' } } })
    emit({ sessionId: 's', filePath: 'f', line: { type: 'user', message: { content: 'follow-up' } } })

    const snap = a.getSnapshot('s')
    expect(snap!.turnDeltas!.length).toBe(1)
    expect(snap!.turnDeltas![0].turnId).toBe(1)
    a.destroy()
  })

  it('merges CLAUDE.md content into claude-md bucket after first line', async () => {
    const { source, emit } = makeSource()
    const reader = { load: vi.fn(async () => ({ text: 'x'.repeat(400), bytes: 400, sources: ['/CLAUDE.md'] })) }
    const a = new ContextWindowAnalyzer(source, reader as unknown as ClaudeMdReader)
    emit({ sessionId: 's', cwd: '/p', filePath: 'f', line: { type: 'user', message: { content: 'hi' } } })
    // Flush microtasks
    await vi.advanceTimersByTimeAsync(1)
    const snap = a.getSnapshot('s')
    expect(reader.load).toHaveBeenCalledWith('/p')
    expect(snap!.buckets['claude-md'].chars).toBe(400)
    a.destroy()
  })
})
