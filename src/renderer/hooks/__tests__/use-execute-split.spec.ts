// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useExecuteSplit, splitGateReason, CREATE_TIMEOUT_MS } from '../use-execute-split'
import { usePaneTreeStore } from '../../stores/pane-tree-store'
import type { Terminal } from '@shared/types'

function makeTerminal(id: string, projectId = 'p1'): Terminal {
  return {
    id,
    title: id,
    cwd: '/',
    isClaudeMode: false,
    projectId,
    createdAt: new Date().toISOString()
  }
}

describe('splitGateReason', () => {
  it('returns no-active when no activeTerminalId', () => {
    expect(splitGateReason(null, 0, 4)).toBe('no-active')
  })
  it('returns limit when count >= limit', () => {
    expect(splitGateReason('t1', 4, 4)).toBe('limit')
    expect(splitGateReason('t1', 5, 4)).toBe('limit')
  })
  it('returns null when allowed', () => {
    expect(splitGateReason('t1', 2, 4)).toBeNull()
  })
})

describe('useExecuteSplit', () => {
  let addTerminal: ReturnType<typeof vi.fn<(terminal: Terminal) => void>>
  let notifyLimit: ReturnType<typeof vi.fn<(limit: number) => void>>
  let notifyError: ReturnType<typeof vi.fn<(message: string) => void>>

  beforeEach(() => {
    usePaneTreeStore.getState().reset()
    addTerminal = vi.fn<(terminal: Terminal) => void>()
    notifyLimit = vi.fn<(limit: number) => void>()
    notifyError = vi.fn<(message: string) => void>()
    Object.defineProperty(globalThis, 'window', {
      value: {
        electron: {
          terminal: {
            loadPaneTree: vi.fn(async () => null),
            savePaneTree: vi.fn(async () => undefined)
          }
        }
      },
      configurable: true,
      writable: true
    })
  })

  it('no-op when no activeTerminalId — does not create terminal', async () => {
    const createTerminal = vi.fn()
    const { result } = renderHook(() =>
      useExecuteSplit({
        projectId: 'p1',
        activeTerminalId: null,
        terminalLimit: 4,
        terminalCount: 0,
        selectedShell: null,
        addTerminal,
        notifyLimit,
        notifyError,
        createTerminal
      })
    )
    expect(result.current.canSplit).toBe(false)
    expect(result.current.reason).toBe('no-active')
    await act(async () => {
      await result.current.executeSplit('right')
    })
    expect(createTerminal).not.toHaveBeenCalled()
  })

  it('at terminal limit, notifies and does not create', async () => {
    const createTerminal = vi.fn()
    const { result } = renderHook(() =>
      useExecuteSplit({
        projectId: 'p1',
        activeTerminalId: 't1',
        terminalLimit: 2,
        terminalCount: 2,
        selectedShell: null,
        addTerminal,
        notifyLimit,
        notifyError,
        createTerminal
      })
    )
    await act(async () => {
      await result.current.executeSplit('right')
    })
    expect(notifyLimit).toHaveBeenCalledWith(2)
    expect(createTerminal).not.toHaveBeenCalled()
  })

  it('creates terminal and splits tree in direction', async () => {
    usePaneTreeStore.setState({ treesByProject: { p1: { kind: 'leaf', terminalId: 't1' } } })
    const createTerminal = vi.fn(async () => makeTerminal('t2'))
    const { result } = renderHook(() =>
      useExecuteSplit({
        projectId: 'p1',
        activeTerminalId: 't1',
        terminalLimit: 4,
        terminalCount: 1,
        selectedShell: null,
        addTerminal,
        notifyLimit,
        notifyError,
        createTerminal
      })
    )
    await act(async () => {
      await result.current.executeSplit('right')
    })
    expect(createTerminal).toHaveBeenCalled()
    expect(addTerminal).toHaveBeenCalled()
    const stored = usePaneTreeStore.getState().getTree('p1')
    expect(stored).toMatchObject({
      kind: 'split',
      orientation: 'row',
      children: [
        { kind: 'leaf', terminalId: 't1' },
        { kind: 'leaf', terminalId: 't2' }
      ]
    })
  })

  it('does not duplicate the new leaf when reconcile race pre-appended it', async () => {
    // Simulate the TERMINAL_CREATED broadcast winning the race: by the time
    // executeSplit awaits createTerminal, reconcile has already appended t2 to
    // the tree. The split must still produce exactly two leaves [t1, t2].
    usePaneTreeStore.setState({
      treesByProject: {
        p1: {
          kind: 'split',
          orientation: 'row',
          ratio: 0.5,
          children: [
            { kind: 'leaf', terminalId: 't1' },
            { kind: 'leaf', terminalId: 't2' }
          ]
        }
      }
    })
    const createTerminal = vi.fn(async () => makeTerminal('t2'))
    const { result } = renderHook(() =>
      useExecuteSplit({
        projectId: 'p1',
        activeTerminalId: 't1',
        terminalLimit: 4,
        terminalCount: 1,
        selectedShell: null,
        addTerminal,
        notifyLimit,
        notifyError,
        createTerminal
      })
    )
    await act(async () => {
      await result.current.executeSplit('right')
    })
    const stored = usePaneTreeStore.getState().getTree('p1')
    expect(stored).toMatchObject({
      kind: 'split',
      orientation: 'row',
      children: [
        { kind: 'leaf', terminalId: 't1' },
        { kind: 'leaf', terminalId: 't2' }
      ]
    })
  })

  it('splits the targetTerminalId when given, overriding activeTerminalId', async () => {
    // Tree contains two leaves; active is t1, but right-click targets t2.
    usePaneTreeStore.setState({
      treesByProject: {
        p1: {
          kind: 'split',
          orientation: 'row',
          ratio: 0.5,
          children: [
            { kind: 'leaf', terminalId: 't1' },
            { kind: 'leaf', terminalId: 't2' }
          ]
        }
      }
    })
    const createTerminal = vi.fn(async () => makeTerminal('t3'))
    const { result } = renderHook(() =>
      useExecuteSplit({
        projectId: 'p1',
        activeTerminalId: 't1',
        terminalLimit: 4,
        terminalCount: 2,
        selectedShell: null,
        addTerminal,
        notifyLimit,
        notifyError,
        createTerminal
      })
    )
    await act(async () => {
      await result.current.executeSplit('right', 't2')
    })
    const stored = usePaneTreeStore.getState().getTree('p1')
    // Expected: t2 is replaced by a row split [t2, t3], wrapped under the
    // outer row with t1 still on the left.
    expect(stored).toMatchObject({
      kind: 'split',
      orientation: 'row',
      children: [
        { kind: 'leaf', terminalId: 't1' },
        {
          kind: 'split',
          orientation: 'row',
          children: [
            { kind: 'leaf', terminalId: 't2' },
            { kind: 'leaf', terminalId: 't3' }
          ]
        }
      ]
    })
  })

  it('rollbacks when terminal creation fails', async () => {
    const createTerminal = vi.fn(async () => {
      throw new Error('boom')
    })
    const { result } = renderHook(() =>
      useExecuteSplit({
        projectId: 'p1',
        activeTerminalId: 't1',
        terminalLimit: 4,
        terminalCount: 1,
        selectedShell: null,
        addTerminal,
        notifyLimit,
        notifyError,
        createTerminal
      })
    )
    await act(async () => {
      await result.current.executeSplit('left')
    })
    expect(notifyError).toHaveBeenCalled()
    expect(addTerminal).not.toHaveBeenCalled()
  })

  it('source closed mid-menu: falls back to active pane with direction + notifyError', async () => {
    // Right-click opened menu while source=tSrc existed; before Split-right
    // fired, tSrc closed (sibling remove → collapse). executeSplit should
    // preserve direction by falling back to activeTerminalId AND tell the
    // user their original target is gone.
    usePaneTreeStore.setState({
      treesByProject: {
        p1: {
          kind: 'split',
          orientation: 'row',
          ratio: 0.5,
          children: [
            { kind: 'leaf', terminalId: 'tActive' },
            { kind: 'leaf', terminalId: 'tOther' }
          ]
        }
      }
    })
    const createTerminal = vi.fn(async () => makeTerminal('tNew'))
    const { result } = renderHook(() =>
      useExecuteSplit({
        projectId: 'p1',
        activeTerminalId: 'tActive',
        terminalLimit: 4,
        terminalCount: 2,
        selectedShell: null,
        addTerminal,
        notifyLimit,
        notifyError,
        createTerminal
      })
    )
    await act(async () => {
      await result.current.executeSplit('down', 'tClosedSrc')
    })

    expect(notifyError).toHaveBeenCalled()
    const stored = usePaneTreeStore.getState().getTree('p1')
    // 'down' direction applied to tActive (column split: [tActive, tNew]).
    expect(stored).toMatchObject({
      kind: 'split',
      orientation: 'row',
      children: [
        {
          kind: 'split',
          orientation: 'column',
          children: [
            { kind: 'leaf', terminalId: 'tActive' },
            { kind: 'leaf', terminalId: 'tNew' }
          ]
        },
        { kind: 'leaf', terminalId: 'tOther' }
      ]
    })
  })

  it('destroys the orphan terminal if create resolves after the timeout sentinel', async () => {
    vi.useFakeTimers()
    try {
      // createTerminal resolves AFTER the timeout fires. We must destroy the
      // late-arriving terminal so the main-side PTY doesn't leak and the
      // pane-tree reconcile doesn't auto-append a phantom pane.
      let resolveLate!: (t: Terminal) => void
      const latePromise = new Promise<Terminal>((resolve) => {
        resolveLate = resolve
      })
      const createTerminal = vi.fn(() => latePromise)
      const destroyMock = vi.fn(async () => true)
      ;(window as unknown as { electron: unknown }).electron = {
        terminal: {
          loadPaneTree: vi.fn(async () => null),
          savePaneTree: vi.fn(async () => undefined),
          destroy: destroyMock
        }
      }

      const { result } = renderHook(() =>
        useExecuteSplit({
          projectId: 'p1',
          activeTerminalId: 't1',
          terminalLimit: 4,
          terminalCount: 1,
          selectedShell: null,
          addTerminal,
          notifyLimit,
          notifyError,
          createTerminal
        })
      )

      let call!: Promise<void>
      act(() => {
        call = result.current.executeSplit('right')
      })
      await act(async () => {
        await vi.advanceTimersByTimeAsync(CREATE_TIMEOUT_MS)
        await call
      })

      // Now main finally answers — the orphan must be cleaned up.
      resolveLate(makeTerminal('lateOrphan'))
      await vi.runAllTimersAsync()
      await Promise.resolve()
      await Promise.resolve()

      expect(destroyMock).toHaveBeenCalledWith('lateOrphan')
    } finally {
      vi.useRealTimers()
    }
  })

  it('times out create and releases in-flight slot so next split proceeds', async () => {
    vi.useFakeTimers()
    try {
      // First call: createTerminal returns a never-resolving promise -> must time out.
      // Second call (after timeout): createTerminal resolves quickly -> must succeed,
      // proving the in-flight counter was decremented on timeout.
      let callIdx = 0
      const createTerminal = vi.fn((): Promise<Terminal> => {
        callIdx += 1
        if (callIdx === 1) return new Promise<Terminal>(() => {})
        return Promise.resolve(makeTerminal(`tnew${callIdx}`))
      })
      const { result } = renderHook(() =>
        useExecuteSplit({
          projectId: 'p1',
          activeTerminalId: 't1',
          terminalLimit: 4,
          terminalCount: 1,
          selectedShell: null,
          addTerminal,
          notifyLimit,
          notifyError,
          createTerminal
        })
      )

      // Kick off the hanging call but do not await — we will advance fake timers
      // then await the resulting promise so `notifyError` resolves before assert.
      let firstCall!: Promise<void>
      act(() => {
        firstCall = result.current.executeSplit('right')
      })
      await act(async () => {
        await vi.advanceTimersByTimeAsync(CREATE_TIMEOUT_MS)
        await firstCall
      })

      expect(notifyError).toHaveBeenCalled()
      expect(addTerminal).not.toHaveBeenCalled()

      // Second call should proceed since in-flight slot was released.
      await act(async () => {
        await result.current.executeSplit('right')
      })
      expect(addTerminal).toHaveBeenCalledTimes(1)
      expect(createTerminal).toHaveBeenCalledTimes(2)
    } finally {
      vi.useRealTimers()
    }
  })

  it('at-limit hotkey path still calls executeSplit so notifyLimit fires from the gate', async () => {
    // Phase 2: the App-level onSplit prop used to be `canSplit ? handler : undefined`,
    // which silently no-oped on the global hotkey when at limit while the
    // xterm-focused hotkey path produced a toast. Callers should always wire
    // the handler — executeSplit's own gate then emits notifyLimit uniformly.
    const createTerminal = vi.fn()
    const { result } = renderHook(() =>
      useExecuteSplit({
        projectId: 'p1',
        activeTerminalId: 't1',
        terminalLimit: 2,
        terminalCount: 2,
        selectedShell: null,
        addTerminal,
        notifyLimit,
        notifyError,
        createTerminal
      })
    )
    expect(result.current.canSplit).toBe(false)
    expect(result.current.reason).toBe('limit')
    await act(async () => {
      await result.current.executeSplit('right')
    })
    expect(notifyLimit).toHaveBeenCalledWith(2)
    expect(createTerminal).not.toHaveBeenCalled()
  })

  it('no-active path stays silent — executeSplit returns without toast', async () => {
    // Complements the at-limit test above: when there is no active terminal,
    // the global hotkey path should NOT spam a toast (welcome screen case).
    const createTerminal = vi.fn()
    const { result } = renderHook(() =>
      useExecuteSplit({
        projectId: null,
        activeTerminalId: null,
        terminalLimit: 4,
        terminalCount: 0,
        selectedShell: null,
        addTerminal,
        notifyLimit,
        notifyError,
        createTerminal
      })
    )
    await act(async () => {
      await result.current.executeSplit('right')
    })
    expect(notifyLimit).not.toHaveBeenCalled()
    expect(notifyError).not.toHaveBeenCalled()
    expect(createTerminal).not.toHaveBeenCalled()
  })

  it('rejects concurrent splits past the limit (in-flight counter prevents race)', async () => {
    // terminalCount=3, terminalLimit=4 → only one split should succeed even if
    // two callers fire simultaneously before terminalCount catches up.
    let nextId = 0
    const createTerminal = vi.fn(async () => {
      // simulate IPC latency so both calls overlap
      await new Promise((r) => setTimeout(r, 5))
      nextId += 1
      return makeTerminal(`tnew${nextId}`)
    })
    const { result } = renderHook(() =>
      useExecuteSplit({
        projectId: 'p1',
        activeTerminalId: 't1',
        terminalLimit: 4,
        terminalCount: 3,
        selectedShell: null,
        addTerminal,
        notifyLimit,
        notifyError,
        createTerminal
      })
    )
    await act(async () => {
      await Promise.all([
        result.current.executeSplit('right'),
        result.current.executeSplit('right')
      ])
    })
    expect(createTerminal).toHaveBeenCalledTimes(1)
    expect(notifyLimit).toHaveBeenCalledWith(4)
  })
})
