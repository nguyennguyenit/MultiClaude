import { create } from 'zustand'
import type { PaneTree } from '@shared/types'

export const PANE_TREE_SAVE_DEBOUNCE_MS = 200

interface PaneTreeState {
  treesByProject: Record<string, PaneTree | null>
  loadTreeForProject: (projectId: string) => Promise<PaneTree | null>
  setTree: (projectId: string, tree: PaneTree | null) => void
  getTree: (projectId: string) => PaneTree | null
  reset: () => void
}

const pendingSaves = new Map<string, ReturnType<typeof setTimeout>>()

function scheduleSave(projectId: string, tree: PaneTree | null): void {
  const existing = pendingSaves.get(projectId)
  if (existing) clearTimeout(existing)
  const handle = setTimeout(() => {
    pendingSaves.delete(projectId)
    void window.electron?.terminal?.savePaneTree?.(projectId, tree)
  }, PANE_TREE_SAVE_DEBOUNCE_MS)
  pendingSaves.set(projectId, handle)
}

export const usePaneTreeStore = create<PaneTreeState>((set, get) => ({
  treesByProject: {},

  async loadTreeForProject(projectId) {
    const tree = (await window.electron?.terminal?.loadPaneTree?.(projectId)) ?? null
    set((state) => ({
      treesByProject: { ...state.treesByProject, [projectId]: tree }
    }))
    return tree
  },

  setTree(projectId, tree) {
    set((state) => ({
      treesByProject: { ...state.treesByProject, [projectId]: tree }
    }))
    scheduleSave(projectId, tree)
  },

  getTree(projectId) {
    return get().treesByProject[projectId] ?? null
  },

  reset() {
    for (const handle of pendingSaves.values()) clearTimeout(handle)
    pendingSaves.clear()
    set({ treesByProject: {} })
  }
}))
