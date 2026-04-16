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
const pendingTrees = new Map<string, PaneTree | null>()

function scheduleSave(projectId: string, tree: PaneTree | null): void {
  const existing = pendingSaves.get(projectId)
  if (existing) clearTimeout(existing)
  pendingTrees.set(projectId, tree)
  const handle = setTimeout(() => {
    pendingSaves.delete(projectId)
    pendingTrees.delete(projectId)
    void window.electron?.terminal?.savePaneTree?.(projectId, tree)
  }, PANE_TREE_SAVE_DEBOUNCE_MS)
  pendingSaves.set(projectId, handle)
}

export function flushPaneTreeSaves(): void {
  for (const [projectId, handle] of pendingSaves) {
    clearTimeout(handle)
    const tree = pendingTrees.get(projectId) ?? null
    void window.electron?.terminal?.savePaneTree?.(projectId, tree)
  }
  pendingSaves.clear()
  pendingTrees.clear()
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
    pendingTrees.clear()
    set({ treesByProject: {} })
  }
}))
