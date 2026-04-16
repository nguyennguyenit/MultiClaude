import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { usePaneTreeStore, PANE_TREE_SAVE_DEBOUNCE_MS } from './pane-tree-store'
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
})
