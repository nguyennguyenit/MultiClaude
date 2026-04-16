// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useExecuteSplit, splitGateReason } from '../use-execute-split'
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
})
