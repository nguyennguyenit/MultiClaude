/**
 * Integration test: pane-tree store <-> ProjectStore round-trip.
 *
 * Simulates the upgrade path for an existing user: a legacy store with a flat
 * `terminals[]` layout migrates to a binary tree on first read, survives
 * splits + closes, and persists through reload.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { ProjectStore } from '@main/project/project-store'
import { splitLeaf, closeLeafAndCollapse, listLeafIds } from '@shared/utils/pane-tree'
import type { PaneTree } from '@shared/types'

describe('pane-tree integration: legacy store → migrate → split → close → persist', () => {
  let store: ProjectStore

  beforeEach(() => {
    vi.resetModules()
    store = new ProjectStore()
    store.saveTerminalLayout('p1', {
      projectId: 'p1',
      terminals: [
        { id: 'a', title: 'a', position: 0 },
        { id: 'b', title: 'b', position: 1 },
        { id: 'c', title: 'c', position: 2 }
      ]
    })
  })

  it('migrates then preserves order through one full round-trip', () => {
    const first = store.loadPaneTree('p1')
    expect(first).not.toBeNull()
    expect(listLeafIds(first!)).toEqual(['a', 'b', 'c'])

    const afterSplit = splitLeaf(first!, 'b', 'right', 'd')
    store.savePaneTree('p1', afterSplit)

    const reloaded = store.loadPaneTree('p1')
    expect(reloaded).not.toBeNull()
    expect(listLeafIds(reloaded!)).toEqual(['a', 'b', 'd', 'c'])

    const afterClose = closeLeafAndCollapse(reloaded!, 'd') as PaneTree
    store.savePaneTree('p1', afterClose)

    const final = store.loadPaneTree('p1')
    expect(listLeafIds(final!)).toEqual(['a', 'b', 'c'])
  })

  it('closing the last leaf persists null', () => {
    store.saveTerminalLayout('p2', {
      projectId: 'p2',
      terminals: [{ id: 'only', title: 'only', position: 0 }]
    })
    const tree = store.loadPaneTree('p2')
    const next = closeLeafAndCollapse(tree!, 'only')
    store.savePaneTree('p2', next)
    expect(store.loadPaneTree('p2')).toBeNull()
  })
})
