// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { usePaneTree } from '../use-pane-tree'
import { usePaneTreeStore } from '../../stores/pane-tree-store'
import type { PaneTree } from '@shared/types'

function leaf(id: string): PaneTree {
  return { kind: 'leaf', terminalId: id }
}

describe('usePaneTree', () => {
  let loadMock: ReturnType<typeof vi.fn>

  beforeEach(() => {
    usePaneTreeStore.getState().reset()
    loadMock = vi.fn(async (_pid: string) => null)
    Object.defineProperty(globalThis, 'window', {
      value: {
        electron: {
          terminal: {
            loadPaneTree: loadMock,
            savePaneTree: vi.fn(async () => undefined)
          }
        }
      },
      configurable: true,
      writable: true
    })
  })

  it('returns null for null projectId and does not call load', () => {
    const { result } = renderHook(() => usePaneTree(null))
    expect(result.current.tree).toBeNull()
    expect(loadMock).not.toHaveBeenCalled()
  })

  it('loads the tree for projectId on first mount', async () => {
    loadMock.mockResolvedValueOnce(leaf('a'))
    const { result, rerender } = renderHook(({ pid }: { pid: string | null }) => usePaneTree(pid), {
      initialProps: { pid: 'p1' }
    })
    await act(async () => {
      // allow effect + microtasks to flush
      await Promise.resolve()
    })
    rerender({ pid: 'p1' })
    expect(loadMock).toHaveBeenCalledWith('p1')
    expect(result.current.tree).toEqual(leaf('a'))
  })

  it('setTree forwards to store.setTree for the current project', () => {
    const { result } = renderHook(() => usePaneTree('p1'))
    act(() => result.current.setTree(leaf('b')))
    expect(usePaneTreeStore.getState().getTree('p1')).toEqual(leaf('b'))
  })

  it('setTree is a no-op when projectId is null', () => {
    const { result } = renderHook(() => usePaneTree(null))
    act(() => result.current.setTree(leaf('b')))
    expect(usePaneTreeStore.getState().treesByProject).toEqual({})
  })
})
