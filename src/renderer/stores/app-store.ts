import { create } from 'zustand'
import type { Terminal, Project, ProjectTerminalLayout } from '@shared/types'

interface TerminalWithOutput extends Terminal {
  output: string
}

interface AppState {
  // Terminals
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

  // UI State
  sidebarOpen: boolean
  toggleSidebar: () => void

  // Per-project terminal layouts
  projectTerminals: Record<string, ProjectTerminalLayout>
  setProjectTerminals: (projectId: string, layout: ProjectTerminalLayout) => void
  getProjectTerminals: (projectId: string) => ProjectTerminalLayout | undefined
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
          ? {
              ...t,
              output: (t.output + data).slice(-100000) // Keep last 100KB
            }
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
    set((state) => ({
      projects: state.projects.filter((p) => p.id !== id),
      activeProjectId: state.activeProjectId === id ? null : state.activeProjectId
    })),

  setActiveProject: (id) => set({ activeProjectId: id }),

  // UI State
  sidebarOpen: true,
  toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),

  // Per-project terminal layouts
  projectTerminals: {},

  setProjectTerminals: (projectId, layout) =>
    set((state) => ({
      projectTerminals: { ...state.projectTerminals, [projectId]: layout }
    })),

  getProjectTerminals: (projectId) => get().projectTerminals[projectId]
}))
