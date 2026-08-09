import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  claimTerminalRendererSession,
  getTerminalRendererStatus,
  registerTerminalRendererRetry,
  releaseTerminalRendererSession,
  resetTerminalRendererStatusStoreForTests,
  retryTerminalRenderer,
  setTerminalRendererStatus,
  useTerminalRendererStatusStore,
} from './terminal-renderer-status-store'

describe('terminal renderer status store', () => {
  beforeEach(() => resetTerminalRendererStatusStoreForTests())

  it('publishes only enum status for the owning session', () => {
    const token = Symbol('session')
    claimTerminalRendererSession('term-1', token)

    expect(setTerminalRendererStatus('term-1', token, {
      effective: 'dom',
      fallbackReason: 'webgl-load-failed',
    })).toBe(true)
    expect(getTerminalRendererStatus('term-1')).toEqual({
      terminalId: 'term-1',
      effective: 'dom',
      fallbackReason: 'webgl-load-failed',
    })
    expect(Object.keys(getTerminalRendererStatus('term-1')!)).toEqual([
      'terminalId',
      'effective',
      'fallbackReason',
    ])
  })

  it('rejects arbitrary effective and fallback strings at runtime', () => {
    const token = Symbol('session')
    claimTerminalRendererSession('term-1', token)

    expect(setTerminalRendererStatus('term-1', token, {
      effective: 'canvas',
      fallbackReason: '/private/GPU driver error',
    } as never)).toBe(false)
    expect(getTerminalRendererStatus('term-1')).toBeUndefined()
  })

  it('isolates retry callbacks by terminal and keeps them out of public state', () => {
    const tokenA = Symbol('a')
    const tokenB = Symbol('b')
    const retryA = vi.fn(() => true)
    const retryB = vi.fn(() => false)
    claimTerminalRendererSession('term-a', tokenA)
    claimTerminalRendererSession('term-b', tokenB)
    registerTerminalRendererRetry('term-a', tokenA, retryA)
    registerTerminalRendererRetry('term-b', tokenB, retryB)

    expect(retryTerminalRenderer('term-a')).toBe(true)
    expect(retryTerminalRenderer('term-b')).toBe(false)
    expect(retryA).toHaveBeenCalledTimes(1)
    expect(retryB).toHaveBeenCalledTimes(1)
    expect(useTerminalRendererStatusStore.getState()).not.toHaveProperty('retryCallbacks')
  })

  it('prevents an old same-ID session from updating or deleting its replacement', () => {
    const oldToken = Symbol('old')
    const newToken = Symbol('new')
    claimTerminalRendererSession('term-1', oldToken)
    setTerminalRendererStatus('term-1', oldToken, {
      effective: 'webgl',
      fallbackReason: null,
    })
    claimTerminalRendererSession('term-1', newToken)
    setTerminalRendererStatus('term-1', newToken, {
      effective: 'dom',
      fallbackReason: 'automatic-agent-safe',
    })

    expect(setTerminalRendererStatus('term-1', oldToken, {
      effective: 'dom',
      fallbackReason: 'webgl-context-lost',
    })).toBe(false)
    releaseTerminalRendererSession('term-1', oldToken)
    expect(getTerminalRendererStatus('term-1')?.fallbackReason)
      .toBe('automatic-agent-safe')
  })

  it('synchronously removes status and retry on owning-session release', () => {
    const token = Symbol('session')
    claimTerminalRendererSession('term-1', token)
    setTerminalRendererStatus('term-1', token, {
      effective: 'webgl',
      fallbackReason: null,
    })
    registerTerminalRendererRetry('term-1', token, () => true)

    releaseTerminalRendererSession('term-1', token)

    expect(getTerminalRendererStatus('term-1')).toBeUndefined()
    expect(retryTerminalRenderer('term-1')).toBe(false)
  })

  it('lets only the current session unregister its retry callback', () => {
    const oldToken = Symbol('old')
    const newToken = Symbol('new')
    const retryNew = vi.fn(() => true)
    claimTerminalRendererSession('term-1', oldToken)
    const staleUnsubscribe = registerTerminalRendererRetry(
      'term-1',
      oldToken,
      () => false,
    )
    claimTerminalRendererSession('term-1', newToken)
    registerTerminalRendererRetry('term-1', newToken, retryNew)

    staleUnsubscribe()

    expect(retryTerminalRenderer('term-1')).toBe(true)
    expect(retryNew).toHaveBeenCalledTimes(1)
  })
})
