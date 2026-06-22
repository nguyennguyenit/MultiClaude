import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  attachTerminalOutputDispatcher,
  pauseAndBuffer,
  registerTerminalOutputHandler,
  resetTerminalOutputDispatcherForTests,
  resumeAndFlush,
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

  it('ignores output when no handler is registered', () => {
    const unsubscribe = attachTerminalOutputDispatcher((callback) => {
      expect(() => callback({ terminalId: 'missing', data: 'hello' })).not.toThrow()
      return vi.fn()
    })

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

    it('drops buffered chunks already covered by a snapshot offset', () => {
      const handler = vi.fn()
      registerTerminalOutputHandler('term-1', handler)
      pauseAndBuffer('term-1')

      attachTerminalOutputDispatcher((callback) => {
        callback({ terminalId: 'term-1', data: 'first', startOffset: 0, endOffset: 5 })
        callback({ terminalId: 'term-1', data: 'second', startOffset: 5, endOffset: 11 })
        return vi.fn()
      })

      resumeAndFlush('term-1', { afterOffset: 11 })

      expect(handler).not.toHaveBeenCalled()
    })

    it('flushes only the suffix of a chunk that extends beyond the snapshot offset', () => {
      const handler = vi.fn()
      registerTerminalOutputHandler('term-1', handler)
      pauseAndBuffer('term-1')

      attachTerminalOutputDispatcher((callback) => {
        callback({ terminalId: 'term-1', data: 'abcdef', startOffset: 10, endOffset: 16 })
        callback({ terminalId: 'term-1', data: 'ghi', startOffset: 16, endOffset: 19 })
        return vi.fn()
      })

      resumeAndFlush('term-1', { afterOffset: 13 })

      expect(handler).toHaveBeenCalledTimes(2)
      expect(handler.mock.calls[0][0]).toBe('def')
      expect(handler.mock.calls[1][0]).toBe('ghi')
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

    it('resumeAndFlush with no handler silently discards buffer', () => {
      pauseAndBuffer('no-handler')
      attachTerminalOutputDispatcher((callback) => {
        callback({ terminalId: 'no-handler', data: 'dropped' })
        return vi.fn()
      })
      // Should not throw
      expect(() => resumeAndFlush('no-handler')).not.toThrow()
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
})
