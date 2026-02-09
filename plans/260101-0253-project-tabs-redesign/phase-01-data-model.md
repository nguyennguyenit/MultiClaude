# Phase 1: Data Model + Types

## Objective
Update types and Zustand store for per-project terminal management.

## Files to Modify

### 1. `src/shared/types/index.ts`

Add after line 56 (after `AppSession`):

```typescript
// Per-project terminal layout
export interface ProjectTerminalLayout {
  projectId: string
  terminals: ProjectTerminal[]
}

export interface ProjectTerminal {
  id: string
  title: string
  position: number // Grid position 0-8 (row*3 + col)
}
```

### 2. `src/renderer/stores/app-store.ts`

Replace entire file with:

```typescript
import { create } from 'zustand'
import type { Terminal, Project, ProjectTerminalLayout } from '@shared/types'

interface TerminalWithOutput extends Terminal {
  output: string
}

interface AppState {
  // Terminals (global - all running)
  terminals: TerminalWithOutput[]
  activeTerminalId: string | null
  addTerminal: (terminal: Terminal) => void
  removeTerminal: (id: string) => void
  setActiveTerminal: (id: string | null) => void
  appendOutput: (id: string, data: string) => void

  // Projects
  projects: Project[]
  activeProjectId: string | null
  setProjects: (projects: Project[]) => void
  addProject: (project: Project) => void
  removeProject: (id: string) => void
  setActiveProject: (id: string | null) => void

  // Per-project terminal layouts
  projectTerminals: Record<string, ProjectTerminalLayout>
  setProjectTerminalLayout: (projectId: string, layout: ProjectTerminalLayout) => void
  addTerminalToProject: (projectId: string, terminalId: string, title: string) => void
  removeTerminalFromProject: (projectId: string, terminalId: string) => void
  getActiveProjectTerminals: () => TerminalWithOutput[]

  // UI State
  sidebarOpen: boolean
  toggleSidebar: () => void
}

export const useAppStore = create<AppState>((set, get) => ({
  // Terminals
  terminals: [],
  activeTerminalId: null,

  addTerminal: (terminal) =>
    set((state) => ({
      terminals: [...state.terminals, { ...terminal, output: '' }],
      activeTerminalId: terminal.id
    })),

  removeTerminal: (id) =>
    set((state) => {
      const newTerminals = state.terminals.filter((t) => t.id !== id)
      return {
        terminals: newTerminals,
        activeTerminalId:
          state.activeTerminalId === id
            ? newTerminals[newTerminals.length - 1]?.id || null
            : state.activeTerminalId
      }
    }),

  setActiveTerminal: (id) => set({ activeTerminalId: id }),

  appendOutput: (id, data) =>
    set((state) => ({
      terminals: state.terminals.map((t) =>
        t.id === id
          ? { ...t, output: (t.output + data).slice(-100000) }
          : t
      )
    })),

  // Projects
  projects: [],
  activeProjectId: null,

  setProjects: (projects) => set({ projects }),

  addProject: (project) =>
    set((state) => ({
      projects: [...state.projects, project]
    })),

  removeProject: (id) =>
    set((state) => {
      // Also remove terminal layout
      const { [id]: _, ...remainingLayouts } = state.projectTerminals
      return {
        projects: state.projects.filter((p) => p.id !== id),
        activeProjectId: state.activeProjectId === id ? null : state.activeProjectId,
        projectTerminals: remainingLayouts
      }
    }),

  setActiveProject: (id) => set({ activeProjectId: id }),

  // Per-project terminal layouts
  projectTerminals: {},

  setProjectTerminalLayout: (projectId, layout) =>
    set((state) => ({
      projectTerminals: { ...state.projectTerminals, [projectId]: layout }
    })),

  addTerminalToProject: (projectId, terminalId, title) =>
    set((state) => {
      const existing = state.projectTerminals[projectId]
      const terminals = existing?.terminals || []
      const position = terminals.length // Next available position
      return {
        projectTerminals: {
          ...state.projectTerminals,
          [projectId]: {
            projectId,
            terminals: [...terminals, { id: terminalId, title, position }]
          }
        }
      }
    }),

  removeTerminalFromProject: (projectId, terminalId) =>
    set((state) => {
      const existing = state.projectTerminals[projectId]
      if (!existing) return state
      return {
        projectTerminals: {
          ...state.projectTerminals,
          [projectId]: {
            ...existing,
            terminals: existing.terminals.filter((t) => t.id !== terminalId)
          }
        }
      }
    }),

  getActiveProjectTerminals: () => {
    const state = get()
    const layout = state.projectTerminals[state.activeProjectId || '']
    if (!layout) return []
    const terminalIds = new Set(layout.terminals.map((t) => t.id))
    return state.terminals.filter((t) => terminalIds.has(t.id))
  },

  // UI State
  sidebarOpen: true,
  toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen }))
}))
```

## Validation

After implementation:
1. Build passes: `npm run build`
2. No TypeScript errors
3. Store maintains backwards compatibility
