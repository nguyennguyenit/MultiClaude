// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { useContextSnapshot, STALE_THRESHOLD_MS } from '../use-context-snapshot'
import type { ContextSnapshot } from '@shared/types'

function snap(sessionId: string, total = 10): ContextSnapshot {
  return {
    sessionId,
    buckets: {
      'claude-md': { tokens: total, chars: total, itemCount: 1 },
      'mentioned-file': { tokens: 0, chars: 0, itemCount: 0 },
      'tool-output': { tokens: 0, chars: 0, itemCount: 0 },
      'thinking-text': { tokens: 0, chars: 0, itemCount: 0 },
      'task-coordination': { tokens: 0, chars: 0, itemCount: 0 },
      'user-messages': { tokens: 0, chars: 0, itemCount: 0 }
    },
    total,
    updatedAt: Date.now()
  }
}

describe('useContextSnapshot', () => {
  let listeners: Array<(s: ContextSnapshot) => void>
  let unsubs: number

  beforeEach(() => {
    listeners = []
    unsubs = 0
    vi.stubGlobal('electron', {
      context: {
        getSnapshot: vi.fn(async (sid: string) => snap(sid, 5)),
        onSnapshot: vi.fn((cb: (s: ContextSnapshot) => void) => {
          listeners.push(cb)
          return () => { unsubs++ }
        })
      }
    })
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('returns null snapshot for null sessionId', () => {
    const { result } = renderHook(() => useContextSnapshot(null))
    expect(result.current.snapshot).toBeNull()
    expect(result.current.isStale).toBe(false)
  })

  it('hydrates via getSnapshot then updates on event', async () => {
    const { result } = renderHook(() => useContextSnapshot('s1'))
    await waitFor(() => expect(result.current.snapshot?.total).toBe(5))
    act(() => { listeners.forEach((cb) => cb(snap('s1', 99))) })
    expect(result.current.snapshot?.total).toBe(99)
  })

  it('ignores snapshots for a different session', async () => {
    const { result } = renderHook(() => useContextSnapshot('s1'))
    await waitFor(() => expect(result.current.snapshot).not.toBeNull())
    act(() => { listeners.forEach((cb) => cb(snap('other', 999))) })
    expect(result.current.snapshot?.sessionId).toBe('s1')
    expect(result.current.snapshot?.total).toBe(5)
  })

  it('clears state and rebinds on sessionId change', async () => {
    const { result, rerender } = renderHook(
      ({ sid }: { sid: string | null }) => useContextSnapshot(sid),
      { initialProps: { sid: 's1' as string | null } }
    )
    await waitFor(() => expect(result.current.snapshot?.sessionId).toBe('s1'))
    rerender({ sid: 's2' })
    await waitFor(() => expect(result.current.snapshot?.sessionId).toBe('s2'))
  })

  it('unsubscribes on unmount', () => {
    const { unmount } = renderHook(() => useContextSnapshot('s1'))
    unmount()
    expect(unsubs).toBe(1)
  })

  it('flips isStale true after silence exceeding threshold', async () => {
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval', 'Date'] })
    const { result } = renderHook(() => useContextSnapshot('s1'))
    // let the async hydration resolve
    await vi.runOnlyPendingTimersAsync()
    await waitFor(() => expect(result.current.snapshot?.total).toBe(5))
    expect(result.current.isStale).toBe(false)
    await act(async () => {
      vi.advanceTimersByTime(STALE_THRESHOLD_MS + 1_500)
    })
    expect(result.current.isStale).toBe(true)

    // fresh snapshot clears the stale flag
    await act(async () => {
      listeners.forEach((cb) => cb(snap('s1', 12)))
    })
    expect(result.current.isStale).toBe(false)
  })
})
