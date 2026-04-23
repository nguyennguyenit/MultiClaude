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
