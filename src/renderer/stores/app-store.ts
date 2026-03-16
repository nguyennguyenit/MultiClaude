import { create } from 'zustand'
import type { Terminal, Project, ProjectTerminalLayout, ActivityBarState } from '@shared/types'
import { DEFAULT_ACTIVITY_BAR_STATE, TERMINAL_OUTPUT_BUFFER_MAX, TERMINAL_OUTPUT_BUFFER_TRIM_TO } from '@shared/constants'

export type ActiveView = 'terminals' | 'github'

interface AppState {
  // Terminals
  terminals: Terminal[]
  terminalOutputs: Record<string, string>
  activeTerminalId: string | null
  addTerminal: (terminal: Terminal) => void
  removeTerminal: (id: string) => void
  setActiveTerminal: (id: string | null) => void
  updateTerminalTitle: (id: string, title: string) => void
  getTerminalOutput: (id: string) => string
  appendOutput: (id: string, data: string) => void

  // Projects
  projects: Project[]
  activeProjectId: string | null
  setProjects: (projects: Project[]) => void
  addProject: (project: Project) => void
  removeProject: (id: string) => void
  setActiveProject: (id: string | null) => void
  switchToProject: (projectId: string, terminalId?: string) => void

  // UI State - Activity Bar (3 states: collapsed, expanded, hidden)
  activityBarState: ActivityBarState
  setActivityBarState: (state: ActivityBarState) => void
  cycleActivityBarState: () => void // collapsed → expanded → hidden → collapsed
  activeView: ActiveView
  setActiveView: (view: ActiveView) => void

  // Per-project terminal layouts
  projectTerminals: Record<string, ProjectTerminalLayout>
  setProjectTerminals: (projectId: string, layout: ProjectTerminalLayout) => void
  getProjectTerminals: (projectId: string) => ProjectTerminalLayout | undefined
}

export const useAppStore = create<AppState>((set, get) => ({
  // Terminals
  terminals: [],
  terminalOutputs: {},
  activeTerminalId: null,

  addTerminal: (terminal) =>
    set((state) => ({
      terminals: [...state.terminals, terminal],
      terminalOutputs: {
        ...state.terminalOutputs,
        [terminal.id]: ''
      },
      activeTerminalId: terminal.id
    })),

  removeTerminal: (id) =>
    set((state) => {
      const newTerminals = state.terminals.filter((t) => t.id !== id)
      const remainingOutputs = { ...state.terminalOutputs }
      delete remainingOutputs[id]
      return {
        terminals: newTerminals,
        terminalOutputs: remainingOutputs,
        activeTerminalId:
          state.activeTerminalId === id
            ? newTerminals[newTerminals.length - 1]?.id || null
            : state.activeTerminalId
      }
    }),

  setActiveTerminal: (id) => set({ activeTerminalId: id }),

  updateTerminalTitle: (id, title) =>
    set((state) => ({
      terminals: state.terminals.map((t) =>
        t.id === id ? { ...t, title } : t
      )
    })),

  getTerminalOutput: (id) => get().terminalOutputs[id] ?? '',

  appendOutput: (id, data) =>
    set((state) => ({
      terminalOutputs: {
        ...state.terminalOutputs,
        [id]: (() => {
          const nextOutput = (state.terminalOutputs[id] ?? '') + data
          return nextOutput.length > TERMINAL_OUTPUT_BUFFER_MAX
            ? nextOutput.slice(-TERMINAL_OUTPUT_BUFFER_TRIM_TO)
            : nextOutput
        })()
      }
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

  // Atomic project switch: updates project + terminal in single state update (prevents race conditions)
  // terminalId param allows future use for restoring specific terminal (e.g., from saved layout)
  switchToProject: (projectId, terminalId) =>
    set((state) => {
      const projectTerminals = state.terminals.filter(t => t.projectId === projectId)
      return {
        activeProjectId: projectId,
        activeTerminalId: terminalId ?? projectTerminals[0]?.id ?? null
      }
    }),

  // UI State - Activity Bar (3 states: collapsed, expanded, hidden)
  activityBarState: DEFAULT_ACTIVITY_BAR_STATE,
  setActivityBarState: (state) => set({ activityBarState: state }),
  cycleActivityBarState: () => set((state) => {
    const cycle: Record<ActivityBarState, ActivityBarState> = {
      collapsed: 'expanded',
      expanded: 'hidden',
      hidden: 'collapsed'
    }
    return { activityBarState: cycle[state.activityBarState] }
  }),
  activeView: 'terminals' as ActiveView,
  setActiveView: (view) => set({ activeView: view }),

  // Per-project terminal layouts
  projectTerminals: {},

  setProjectTerminals: (projectId, layout) =>
    set((state) => ({
      projectTerminals: { ...state.projectTerminals, [projectId]: layout }
    })),

  getProjectTerminals: (projectId) => get().projectTerminals[projectId]
}))

// Expose store globally for E2E testing (safe for Electron desktop app)
if (typeof window !== 'undefined') {
  (window as unknown as { __APP_STORE__: typeof useAppStore }).__APP_STORE__ = useAppStore
}
