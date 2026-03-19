import { create } from 'zustand'
import type { Terminal, Project, ProjectTerminalLayout, ActivityBarState } from '@shared/types'
import { DEFAULT_ACTIVITY_BAR_STATE, TERMINAL_OUTPUT_BUFFER_MAX, TERMINAL_OUTPUT_BUFFER_TRIM_TO } from '@shared/constants'
import type { TerminalKeyboardEnhancementState } from '../utils/keyboard-enhancement-utils'

export type ActiveView = 'terminals' | 'github'

const DEFAULT_PROJECT_KEY = '__default_project__'

function getTerminalProjectKey(projectId?: string): string {
  return projectId ?? DEFAULT_PROJECT_KEY
}

function getProjectTerminalIds(terminals: Terminal[], projectId: string | null): string[] {
  if (!projectId) return []
  return terminals.filter((terminal) => terminal.projectId === projectId).map((terminal) => terminal.id)
}

interface AppState {
  // Terminals
  terminals: Terminal[]
  terminalOutputs: Record<string, string>
  terminalKeyboardEnhancements: Record<string, TerminalKeyboardEnhancementState>
  activeTerminalId: string | null
  lastActiveTerminalByProjectId: Record<string, string>
  addTerminal: (terminal: Terminal) => void
  removeTerminal: (id: string) => void
  setActiveTerminal: (id: string | null) => void
  updateTerminalTitle: (id: string, title: string) => void
  getTerminalOutput: (id: string) => string
  appendOutput: (id: string, data: string) => void
  getTerminalKeyboardEnhancement: (id: string) => TerminalKeyboardEnhancementState | null
  setTerminalKeyboardEnhancement: (id: string, state: TerminalKeyboardEnhancementState) => void

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
  terminalKeyboardEnhancements: {},
  activeTerminalId: null,
  lastActiveTerminalByProjectId: {},

  addTerminal: (terminal) =>
    set((state) => ({
      terminals: [...state.terminals, terminal],
      terminalOutputs: {
        ...state.terminalOutputs,
        [terminal.id]: ''
      },
      terminalKeyboardEnhancements: {
        ...state.terminalKeyboardEnhancements
      },
      activeTerminalId: terminal.id,
      lastActiveTerminalByProjectId: {
        ...state.lastActiveTerminalByProjectId,
        [getTerminalProjectKey(terminal.projectId)]: terminal.id
      }
    })),

  removeTerminal: (id) =>
    set((state) => {
      const removedTerminal = state.terminals.find((terminal) => terminal.id === id)
      const newTerminals = state.terminals.filter((t) => t.id !== id)
      const remainingOutputs = { ...state.terminalOutputs }
      const remainingKeyboardEnhancements = { ...state.terminalKeyboardEnhancements }
      delete remainingOutputs[id]
      delete remainingKeyboardEnhancements[id]

      const nextLastActiveTerminalByProjectId = { ...state.lastActiveTerminalByProjectId }
      if (removedTerminal) {
        const projectKey = getTerminalProjectKey(removedTerminal.projectId)
        if (nextLastActiveTerminalByProjectId[projectKey] === id) {
          const replacementTerminal = [...newTerminals]
            .reverse()
            .find((terminal) => getTerminalProjectKey(terminal.projectId) === projectKey)

          if (replacementTerminal) {
            nextLastActiveTerminalByProjectId[projectKey] = replacementTerminal.id
          } else {
            delete nextLastActiveTerminalByProjectId[projectKey]
          }
        }
      }

      const activeProjectTerminalIds = getProjectTerminalIds(newTerminals, state.activeProjectId)
      return {
        terminals: newTerminals,
        terminalOutputs: remainingOutputs,
        terminalKeyboardEnhancements: remainingKeyboardEnhancements,
        activeTerminalId:
          state.activeTerminalId === id
            ? activeProjectTerminalIds[activeProjectTerminalIds.length - 1]
              ?? newTerminals[newTerminals.length - 1]?.id
              ?? null
            : state.activeTerminalId,
        lastActiveTerminalByProjectId: nextLastActiveTerminalByProjectId
      }
    }),

  setActiveTerminal: (id) =>
    set((state) => {
      if (!id) {
        return { activeTerminalId: null }
      }

      const terminal = state.terminals.find((candidate) => candidate.id === id)
      if (!terminal) {
        return { activeTerminalId: state.activeTerminalId }
      }

      return {
        activeTerminalId: id,
        lastActiveTerminalByProjectId: {
          ...state.lastActiveTerminalByProjectId,
          [getTerminalProjectKey(terminal.projectId)]: id
        }
      }
    }),

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

  getTerminalKeyboardEnhancement: (id) => get().terminalKeyboardEnhancements[id] ?? null,

  setTerminalKeyboardEnhancement: (id, state) =>
    set((store) => ({
      terminalKeyboardEnhancements: {
        ...store.terminalKeyboardEnhancements,
        [id]: state
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
    set((state) => {
      const nextLastActiveTerminalByProjectId = { ...state.lastActiveTerminalByProjectId }
      delete nextLastActiveTerminalByProjectId[getTerminalProjectKey(id)]

      return {
        projects: state.projects.filter((p) => p.id !== id),
        activeProjectId: state.activeProjectId === id ? null : state.activeProjectId,
        activeTerminalId: state.activeProjectId === id ? null : state.activeTerminalId,
        lastActiveTerminalByProjectId: nextLastActiveTerminalByProjectId
      }
    }),

  setActiveProject: (id) => set({ activeProjectId: id }),

  // Atomic project switch: updates project + terminal in single state update (prevents race conditions)
  // terminalId param allows future use for restoring specific terminal (e.g., from saved layout)
  switchToProject: (projectId, terminalId) =>
    set((state) => {
      const projectTerminalIds = getProjectTerminalIds(state.terminals, projectId)
      const preferredTerminalId = terminalId ?? state.lastActiveTerminalByProjectId[getTerminalProjectKey(projectId)] ?? null
      const activeTerminalId = preferredTerminalId && projectTerminalIds.includes(preferredTerminalId)
        ? preferredTerminalId
        : projectTerminalIds[0] ?? null

      return {
        activeProjectId: projectId,
        activeTerminalId
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
