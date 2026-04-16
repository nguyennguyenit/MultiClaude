import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { usePaneTreeStore, PANE_TREE_SAVE_DEBOUNCE_MS, flushPaneTreeSaves } from './pane-tree-store'
import type { PaneTree } from '@shared/types'

function leaf(id: string): PaneTree {
  return { kind: 'leaf', terminalId: id }
}

describe('usePaneTreeStore', () => {
  let loadMock: ReturnType<typeof vi.fn>
  let saveMock: ReturnType<typeof vi.fn>

  beforeEach(() => {
    usePaneTreeStore.getState().reset()
    loadMock = vi.fn(async (_pid: string) => null)
    saveMock = vi.fn(async () => undefined)
    Object.defineProperty(globalThis, 'window', {
      value: {
        electron: {
          terminal: {
            loadPaneTree: loadMock,
            savePaneTree: saveMock
          }
        }
      },
      configurable: true,
      writable: true
    })
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('loadTreeForProject calls IPC and stores tree', async () => {
    loadMock.mockResolvedValueOnce(leaf('a'))
    await usePaneTreeStore.getState().loadTreeForProject('p1')
    expect(loadMock).toHaveBeenCalledWith('p1')
    expect(usePaneTreeStore.getState().getTree('p1')).toEqual(leaf('a'))
  })

  it('setTree updates local state immediately', () => {
    usePaneTreeStore.getState().setTree('p1', leaf('a'))
    expect(usePaneTreeStore.getState().getTree('p1')).toEqual(leaf('a'))
  })

  it('setTree schedules a debounced save after PANE_TREE_SAVE_DEBOUNCE_MS', async () => {
    usePaneTreeStore.getState().setTree('p1', leaf('a'))
    expect(saveMock).not.toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(PANE_TREE_SAVE_DEBOUNCE_MS)
    expect(saveMock).toHaveBeenCalledTimes(1)
    expect(saveMock).toHaveBeenCalledWith('p1', leaf('a'))
  })

  it('multiple rapid setTree calls coalesce into a single save', async () => {
    usePaneTreeStore.getState().setTree('p1', leaf('a'))
    usePaneTreeStore.getState().setTree('p1', leaf('b'))
    usePaneTreeStore.getState().setTree('p1', leaf('c'))
    await vi.advanceTimersByTimeAsync(PANE_TREE_SAVE_DEBOUNCE_MS)
    expect(saveMock).toHaveBeenCalledTimes(1)
    expect(saveMock).toHaveBeenCalledWith('p1', leaf('c'))
  })

  it('setTree for different projects keeps their timers independent', async () => {
    usePaneTreeStore.getState().setTree('p1', leaf('a'))
    await vi.advanceTimersByTimeAsync(PANE_TREE_SAVE_DEBOUNCE_MS / 2)
    usePaneTreeStore.getState().setTree('p2', leaf('b'))
    await vi.advanceTimersByTimeAsync(PANE_TREE_SAVE_DEBOUNCE_MS / 2)
    expect(saveMock).toHaveBeenCalledWith('p1', leaf('a'))
    await vi.advanceTimersByTimeAsync(PANE_TREE_SAVE_DEBOUNCE_MS / 2)
    expect(saveMock).toHaveBeenCalledWith('p2', leaf('b'))
  })

  it('setTree with null clears the local tree', () => {
    usePaneTreeStore.getState().setTree('p1', leaf('a'))
    usePaneTreeStore.getState().setTree('p1', null)
    expect(usePaneTreeStore.getState().getTree('p1')).toBeNull()
  })

  it('flushPaneTreeSaves commits all pending debounced saves immediately', () => {
    usePaneTreeStore.getState().setTree('p1', leaf('a'))
    usePaneTreeStore.getState().setTree('p2', leaf('b'))
    expect(saveMock).not.toHaveBeenCalled()
    flushPaneTreeSaves()
    expect(saveMock).toHaveBeenCalledWith('p1', leaf('a'))
    expect(saveMock).toHaveBeenCalledWith('p2', leaf('b'))
    expect(saveMock).toHaveBeenCalledTimes(2)
  })

  it('flushPaneTreeSaves is a no-op when no saves are pending', () => {
    flushPaneTreeSaves()
    expect(saveMock).not.toHaveBeenCalled()
  })

  it('surfaces IPC save rejections via console.error instead of swallowing', async () => {
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    saveMock.mockRejectedValueOnce(new Error('ipc-boom'))
    usePaneTreeStore.getState().setTree('p1', leaf('a'))
    await vi.advanceTimersByTimeAsync(PANE_TREE_SAVE_DEBOUNCE_MS)
    // Give the rejection time to surface to its catch handler.
    await Promise.resolve()
    await Promise.resolve()
    expect(consoleErrorSpy).toHaveBeenCalled()
    // Error log must include the projectId so devtools users can triage.
    const loggedArgs = consoleErrorSpy.mock.calls.flat()
    const hasProjectId = loggedArgs.some((arg) => {
      if (typeof arg === 'string') return arg.includes('p1')
      if (arg && typeof arg === 'object' && 'projectId' in arg) {
        return (arg as { projectId: string }).projectId === 'p1'
      }
      return false
    })
    expect(hasProjectId).toBe(true)
    consoleErrorSpy.mockRestore()
  })

  it('flushPaneTreeSaves surfaces IPC save rejections', async () => {
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    saveMock.mockRejectedValueOnce(new Error('ipc-boom-flush'))
    usePaneTreeStore.getState().setTree('p1', leaf('a'))
    flushPaneTreeSaves()
    await Promise.resolve()
    await Promise.resolve()
    expect(consoleErrorSpy).toHaveBeenCalled()
    consoleErrorSpy.mockRestore()
  })
})
