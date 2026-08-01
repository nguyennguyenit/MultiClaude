import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  attachTerminalOutputDispatcher,
  pauseAndBuffer,
  registerTerminalOutputHandler,
  resetTerminalOutputDispatcherForTests,
  resumeAndFlush,
  resumeFromSnapshot,
} from './terminal-output-dispatcher'

describe('terminal-output-dispatcher', () => {
  beforeEach(() => {
    resetTerminalOutputDispatcherForTests()
  })

  it('dispatches output only to the matching terminal handler', () => {
    const term1Handler = vi.fn()
    const term2Handler = vi.fn()

    registerTerminalOutputHandler('term-1', term1Handler)
    registerTerminalOutputHandler('term-2', term2Handler)

    const unsubscribe = attachTerminalOutputDispatcher((callback) => {
      callback({ terminalId: 'term-2', data: 'hello' })
      return vi.fn()
    })

    expect(term1Handler).not.toHaveBeenCalled()
    expect(term2Handler).toHaveBeenCalledOnce()
    expect(term2Handler).toHaveBeenCalledWith('hello')

    unsubscribe()
  })

  it('buffers output until a handler is registered and hydration completes', () => {
    const handler = vi.fn()
    const unsubscribe = attachTerminalOutputDispatcher((callback) => {
      expect(() => callback({ terminalId: 'missing', data: 'hello' })).not.toThrow()
      return vi.fn()
    })

    registerTerminalOutputHandler('missing', handler)
    resumeAndFlush('missing')
    expect(handler).toHaveBeenCalledWith('hello')
    unsubscribe()
  })

  it('preserves output that arrives during a handler remount gap', () => {
    const received: string[] = []
    const cleanup = registerTerminalOutputHandler('term-1', data => received.push(data))
    let emit!: (payload: { terminalId: string; data: string }) => void
    const unsubscribe = attachTerminalOutputDispatcher((callback) => {
      emit = callback
      return vi.fn()
    })

    emit({ terminalId: 'term-1', data: 'before-gap' })
    cleanup()
    emit({ terminalId: 'term-1', data: 'during-gap' })
    registerTerminalOutputHandler('term-1', data => received.push(data))
    emit({ terminalId: 'term-1', data: 'after-gap' })

    expect(received).toEqual(['before-gap', 'during-gap', 'after-gap'])
    unsubscribe()
  })

  it('cleanup removes only the handler that registered it', () => {
    const term1Handler = vi.fn()
    const term2Handler = vi.fn()

    const cleanup1 = registerTerminalOutputHandler('term-1', term1Handler)
    registerTerminalOutputHandler('term-2', term2Handler)
    cleanup1()

    const unsubscribe = attachTerminalOutputDispatcher((callback) => {
      callback({ terminalId: 'term-1', data: 'first' })
      callback({ terminalId: 'term-2', data: 'second' })
      return vi.fn()
    })

    expect(term1Handler).not.toHaveBeenCalled()
    expect(term2Handler).toHaveBeenCalledOnce()
    expect(term2Handler).toHaveBeenCalledWith('second')

    unsubscribe()
  })

  it('cleanup of an older handler does not remove a newer replacement', () => {
    const olderHandler = vi.fn()
    const newerHandler = vi.fn()

    const cleanupOlder = registerTerminalOutputHandler('term-1', olderHandler)
    registerTerminalOutputHandler('term-1', newerHandler)
    cleanupOlder()

    const unsubscribe = attachTerminalOutputDispatcher((callback) => {
      callback({ terminalId: 'term-1', data: 'hello' })
      return vi.fn()
    })

    expect(olderHandler).not.toHaveBeenCalled()
    expect(newerHandler).toHaveBeenCalledOnce()
    expect(newerHandler).toHaveBeenCalledWith('hello')

    unsubscribe()
  })

  it('attach helper returns the unsubscribe from the underlying subscribe function', () => {
    const unsubscribe = vi.fn()

    const result = attachTerminalOutputDispatcher(() => unsubscribe)

    result()

    expect(unsubscribe).toHaveBeenCalledOnce()
  })

  describe('pauseAndBuffer / resumeAndFlush', () => {
    it('buffers chunks while paused and does not call handler', () => {
      const handler = vi.fn()
      registerTerminalOutputHandler('term-1', handler)
      pauseAndBuffer('term-1')

      attachTerminalOutputDispatcher((callback) => {
        callback({ terminalId: 'term-1', data: 'chunk1' })
        callback({ terminalId: 'term-1', data: 'chunk2' })
        return vi.fn()
      })

      expect(handler).not.toHaveBeenCalled()
    })

    it('flushes buffered chunks in arrival order on resume', () => {
      const handler = vi.fn()
      registerTerminalOutputHandler('term-1', handler)
      pauseAndBuffer('term-1')

      attachTerminalOutputDispatcher((callback) => {
        callback({ terminalId: 'term-1', data: 'first' })
        callback({ terminalId: 'term-1', data: 'second' })
        callback({ terminalId: 'term-1', data: 'third' })
        return vi.fn()
      })

      expect(handler).not.toHaveBeenCalled()

      resumeAndFlush('term-1')

      expect(handler).toHaveBeenCalledTimes(3)
      expect(handler.mock.calls[0][0]).toBe('first')
      expect(handler.mock.calls[1][0]).toBe('second')
      expect(handler.mock.calls[2][0]).toBe('third')
    })

    it('adopts the first sequenced epoch when snapshot hydration is unavailable', () => {
      const handler = vi.fn()
      registerTerminalOutputHandler('term-1', handler)
      pauseAndBuffer('term-1')

      attachTerminalOutputDispatcher((callback) => {
        callback({
          terminalId: 'term-1',
          streamEpoch: 'live-epoch',
          sequence: 1,
          data: 'degraded-live-output',
        })
        return vi.fn()
      })

      resumeAndFlush('term-1')

      expect(handler).toHaveBeenCalledOnce()
      expect(handler).toHaveBeenCalledWith('degraded-live-output')
    })

    it('adopts a sequenced epoch arriving after snapshot hydration is unavailable', () => {
      const handler = vi.fn()
      registerTerminalOutputHandler('term-1', handler)
      pauseAndBuffer('term-1')
      resumeAndFlush('term-1')

      attachTerminalOutputDispatcher((callback) => {
        callback({
          terminalId: 'term-1',
          streamEpoch: 'late-live-epoch',
          sequence: 1,
          data: 'late-degraded-output',
        })
        return vi.fn()
      })

      expect(handler).toHaveBeenCalledOnce()
      expect(handler).toHaveBeenCalledWith('late-degraded-output')
    })

    it('resumes normal dispatch after resumeAndFlush', () => {
      const handler = vi.fn()
      registerTerminalOutputHandler('term-1', handler)
      pauseAndBuffer('term-1')
      resumeAndFlush('term-1')

      // Should now dispatch directly
      attachTerminalOutputDispatcher((callback) => {
        callback({ terminalId: 'term-1', data: 'live' })
        return vi.fn()
      })

      expect(handler).toHaveBeenCalledOnce()
      expect(handler).toHaveBeenCalledWith('live')
    })

    it('does not affect a different terminal during pause', () => {
      const handler1 = vi.fn()
      const handler2 = vi.fn()
      registerTerminalOutputHandler('term-1', handler1)
      registerTerminalOutputHandler('term-2', handler2)
      pauseAndBuffer('term-1')

      attachTerminalOutputDispatcher((callback) => {
        callback({ terminalId: 'term-1', data: 'buffered' })
        callback({ terminalId: 'term-2', data: 'live' })
        return vi.fn()
      })

      expect(handler1).not.toHaveBeenCalled()
      expect(handler2).toHaveBeenCalledOnce()
      expect(handler2).toHaveBeenCalledWith('live')
    })

    it('resumeAndFlush with no handler retains the buffer for later registration', () => {
      pauseAndBuffer('no-handler')
      attachTerminalOutputDispatcher((callback) => {
        callback({ terminalId: 'no-handler', data: 'dropped' })
        return vi.fn()
      })
      expect(() => resumeAndFlush('no-handler')).not.toThrow()
      const handler = vi.fn()
      registerTerminalOutputHandler('no-handler', handler)
      expect(handler).toHaveBeenCalledWith('dropped')
    })

    it('calling pauseAndBuffer twice does not reset existing buffer', () => {
      const handler = vi.fn()
      registerTerminalOutputHandler('term-1', handler)
      pauseAndBuffer('term-1')

      attachTerminalOutputDispatcher((callback) => {
        callback({ terminalId: 'term-1', data: 'first' })
        return vi.fn()
      })

      pauseAndBuffer('term-1') // second call — must not reset buffer

      attachTerminalOutputDispatcher((callback) => {
        callback({ terminalId: 'term-1', data: 'second' })
        return vi.fn()
      })

      resumeAndFlush('term-1')

      expect(handler).toHaveBeenCalledTimes(2)
      expect(handler.mock.calls[0][0]).toBe('first')
      expect(handler.mock.calls[1][0]).toBe('second')
    })
  })

  describe('sequenced stream contract', () => {
    const snapshot = (watermark: number) => ({
      terminalId: 'term-1',
      streamEpoch: 'epoch-1',
      watermark,
      ansi: '',
      cols: 80,
      rows: 24,
      buffer: 'normal' as const,
    })

    it('drops pre-watermark and duplicate envelopes while applying later output once', () => {
      const handler = vi.fn()
      registerTerminalOutputHandler('term-1', handler)
      pauseAndBuffer('term-1')

      attachTerminalOutputDispatcher(callback => {
        callback({ terminalId: 'term-1', streamEpoch: 'epoch-1', sequence: 1, data: 'included' })
        callback({ terminalId: 'term-1', streamEpoch: 'epoch-1', sequence: 2, data: 'after' })
        callback({ terminalId: 'term-1', streamEpoch: 'epoch-1', sequence: 2, data: 'duplicate' })
        return vi.fn()
      })

      resumeFromSnapshot(snapshot(1))
      expect(handler.mock.calls).toEqual([['after']])
    })

    it('requests one recovery when an out-of-order envelope creates a gap', () => {
      const handler = vi.fn()
      const recover = vi.fn()
      registerTerminalOutputHandler('term-1', handler, recover)
      resumeFromSnapshot(snapshot(1))

      attachTerminalOutputDispatcher(callback => {
        callback({ terminalId: 'term-1', streamEpoch: 'epoch-1', sequence: 3, data: 'gap' })
        callback({ terminalId: 'term-1', streamEpoch: 'epoch-1', sequence: 4, data: 'later' })
        return vi.fn()
      })

      expect(handler).not.toHaveBeenCalled()
      expect(recover).toHaveBeenCalledOnce()
      expect(recover).toHaveBeenCalledWith('gap')
    })

    it('retains every later envelope while a gap recovery is in flight', () => {
      const handler = vi.fn()
      registerTerminalOutputHandler('term-1', handler, vi.fn())
      resumeFromSnapshot(snapshot(0))

      attachTerminalOutputDispatcher(callback => {
        callback({ terminalId: 'term-1', streamEpoch: 'epoch-1', sequence: 2, data: 'two' })
        callback({ terminalId: 'term-1', streamEpoch: 'epoch-1', sequence: 3, data: 'three' })
        return vi.fn()
      })

      resumeFromSnapshot(snapshot(1))
      expect(handler.mock.calls).toEqual([['two'], ['three']])
    })

    it('recovers a sequenced handler-remount gap through a snapshot watermark', () => {
      const firstHandler = vi.fn()
      const cleanup = registerTerminalOutputHandler('term-1', firstHandler, vi.fn())
      resumeFromSnapshot(snapshot(1))
      cleanup()

      attachTerminalOutputDispatcher(callback => {
        callback({ terminalId: 'term-1', streamEpoch: 'epoch-1', sequence: 2, data: 'during-remount' })
        return vi.fn()
      })

      const replacement = vi.fn()
      const recover = vi.fn()
      registerTerminalOutputHandler('term-1', replacement, recover)
      expect(recover).toHaveBeenCalledWith('gap')
      resumeFromSnapshot(snapshot(1))
      expect(replacement).toHaveBeenCalledWith('during-remount')
    })

    it('bounds a handler-gap queue and requests overflow recovery', () => {
      const recover = vi.fn()
      registerTerminalOutputHandler('term-1', vi.fn(), recover)
      resumeFromSnapshot(snapshot(0))
      pauseAndBuffer('term-1')

      attachTerminalOutputDispatcher(callback => {
        for (let sequence = 1; sequence <= 4097; sequence++) {
          callback({ terminalId: 'term-1', streamEpoch: 'epoch-1', sequence, data: 'x' })
        }
        return vi.fn()
      })

      expect(recover).toHaveBeenCalledOnce()
      expect(recover).toHaveBeenCalledWith('overflow')
    })

    it('enforces the queue byte limit using UTF-8 bytes', () => {
      const recover = vi.fn()
      registerTerminalOutputHandler('term-1', vi.fn(), recover)
      resumeFromSnapshot(snapshot(0))
      pauseAndBuffer('term-1')

      attachTerminalOutputDispatcher(callback => {
        callback({
          terminalId: 'term-1',
          streamEpoch: 'epoch-1',
          sequence: 1,
          data: '界'.repeat(350_000),
        })
        return vi.fn()
      })

      expect(recover).toHaveBeenCalledWith('overflow')
    })

    it('allows a new recovery attempt after the five-second timeout', () => {
      vi.useFakeTimers()
      const recover = vi.fn()
      const cleanup = registerTerminalOutputHandler('term-1', vi.fn(), recover)
      resumeFromSnapshot(snapshot(0))

      attachTerminalOutputDispatcher(callback => {
        callback({ terminalId: 'term-1', streamEpoch: 'epoch-1', sequence: 2, data: 'gap' })
        return vi.fn()
      })
      expect(recover).toHaveBeenCalledTimes(1)

      vi.advanceTimersByTime(5000)
      cleanup()
      registerTerminalOutputHandler('term-1', vi.fn(), recover)
      expect(recover).toHaveBeenCalledTimes(2)
      vi.useRealTimers()
    })
  })
})
