import { create } from 'zustand'
import type { AppSettings, ThemeMode, ColorTheme, TerminalLimit } from '@shared/types'
import { DEFAULT_SETTINGS } from '@shared/constants'

const STORAGE_KEY = 'multiclaude-settings'

interface SettingsState {
  settings: AppSettings
  gitPanelOpen: boolean
  settingsModalOpen: boolean
  setThemeMode: (mode: ThemeMode) => void
  setColorTheme: (theme: ColorTheme) => void
  setTerminalLimit: (limit: TerminalLimit) => void
  getTerminalLimitValue: () => number
  setGitPanelOpen: (open: boolean) => void
  setSettingsModalOpen: (open: boolean) => void
  loadSettings: () => void
}

function loadFromStorage(): AppSettings {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored) {
      return { ...DEFAULT_SETTINGS, ...JSON.parse(stored) }
    }
  } catch {
    // Ignore parse errors
  }
  return DEFAULT_SETTINGS
}

function saveToStorage(settings: AppSettings): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings))
  } catch {
    // Ignore storage errors
  }
}

export const useSettingsStore = create<SettingsState>((set, get) => ({
  settings: DEFAULT_SETTINGS,
  gitPanelOpen: false,
  settingsModalOpen: false,

  setThemeMode: (mode) => {
    const newSettings = { ...get().settings, themeMode: mode }
    saveToStorage(newSettings)
    set({ settings: newSettings })
  },

  setColorTheme: (theme) => {
    const newSettings = { ...get().settings, colorTheme: theme }
    saveToStorage(newSettings)
    set({ settings: newSettings })
  },

  setTerminalLimit: (limit) => {
    const newSettings = { ...get().settings, terminalLimit: limit }
    saveToStorage(newSettings)
    set({ settings: newSettings })
  },

  getTerminalLimitValue: () => {
    const { terminalLimit } = get().settings
    // Handle undefined or missing terminalLimit (from old localStorage data)
    if (!terminalLimit) {
      return 9 // default
    }
    if (terminalLimit.preset === 'custom') {
      return terminalLimit.customValue ?? 9
    }
    return terminalLimit.preset
  },

  setGitPanelOpen: (open) => set({ gitPanelOpen: open }),

  setSettingsModalOpen: (open) => set({ settingsModalOpen: open }),

  loadSettings: () => {
    set({ settings: loadFromStorage() })
  }
}))
