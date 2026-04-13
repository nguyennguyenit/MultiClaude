import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  attachTerminalOutputDispatcher,
  registerTerminalOutputHandler,
  resetTerminalOutputDispatcherForTests
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
})
