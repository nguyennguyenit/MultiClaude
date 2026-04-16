import { useCallback, useEffect } from 'react'
import { usePaneTreeStore } from '../stores/pane-tree-store'
import type { PaneTree } from '@shared/types'

/**
 * Composite hook: subscribes to the pane tree for `projectId`, loads it from
 * disk on first access, and returns a setter that updates local state +
 * schedules a debounced save.
 */
export function usePaneTree(projectId: string | null): {
  tree: PaneTree | null
  setTree: (tree: PaneTree | null) => void
} {
  const tree = usePaneTreeStore((s) =>
    projectId ? s.treesByProject[projectId] ?? null : null
  )
  const loadTreeForProject = usePaneTreeStore((s) => s.loadTreeForProject)
  const storeSetTree = usePaneTreeStore((s) => s.setTree)

  useEffect(() => {
    if (!projectId) return
    if (usePaneTreeStore.getState().treesByProject[projectId] !== undefined) return
    void loadTreeForProject(projectId)
  }, [projectId, loadTreeForProject])

  const setTree = useCallback(
    (next: PaneTree | null) => {
      if (!projectId) return
      storeSetTree(projectId, next)
    },
    [projectId, storeSetTree]
  )

  return { tree, setTree }
}
