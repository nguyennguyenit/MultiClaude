import { create } from 'zustand'
import type { AppSettings, ThemeMode, ColorTheme } from '@shared/types'
import { DEFAULT_SETTINGS } from '@shared/constants'

const STORAGE_KEY = 'multiclaude-settings'

interface SettingsState {
  settings: AppSettings
  setThemeMode: (mode: ThemeMode) => void
  setColorTheme: (theme: ColorTheme) => void
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

  loadSettings: () => {
    set({ settings: loadFromStorage() })
  }
}))
