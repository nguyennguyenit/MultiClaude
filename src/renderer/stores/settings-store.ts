import { create } from 'zustand'
import type { AppSettings, ThemeMode, ColorTheme, TerminalLimit, TerminalRenderMode, WindowsShell, WslInfo } from '@shared/types'
import { DEFAULT_SETTINGS } from '@shared/constants'

const STORAGE_KEY = 'multiclaude-settings'

interface SettingsState {
  settings: AppSettings
  wslInfo: WslInfo | null // Cached WSL detection result (Windows only)
  gitPanelOpen: boolean
  settingsModalOpen: boolean
  setThemeMode: (mode: ThemeMode) => void
  setColorTheme: (theme: ColorTheme) => void
  setGlassmorphismEnabled: (enabled: boolean) => void
  setTerminalLimit: (limit: TerminalLimit) => void
  setTerminalRenderMode: (mode: TerminalRenderMode) => void
  setWindowsShell: (shell: WindowsShell) => void
  getTerminalLimitValue: () => number
  setGitPanelOpen: (open: boolean) => void
  setSettingsModalOpen: (open: boolean) => void
  loadSettings: () => void
  detectWsl: () => Promise<void>
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
  wslInfo: null,
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

  setGlassmorphismEnabled: (enabled) => {
    const newSettings = { ...get().settings, glassmorphismEnabled: enabled }
    saveToStorage(newSettings)
    set({ settings: newSettings })
  },

  setTerminalLimit: (limit) => {
    const newSettings = { ...get().settings, terminalLimit: limit }
    saveToStorage(newSettings)
    set({ settings: newSettings })
  },

  setTerminalRenderMode: (mode) => {
    const newSettings = { ...get().settings, terminalRenderMode: mode }
    saveToStorage(newSettings)
    set({ settings: newSettings })
  },

  setWindowsShell: (shell) => {
    const newSettings = { ...get().settings, windowsShell: shell }
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
  },

  detectWsl: async () => {
    // Only run on Windows - check if API exists
    if (typeof window !== 'undefined' && window.electron?.terminal?.detectWsl) {
      try {
        const info = await window.electron.terminal.detectWsl()
        // info is null on non-Windows platforms (main process returns null)
        if (!info) return
        set({ wslInfo: info })

        // Validate saved shell preference - reset if saved distro no longer exists
        const currentShell = get().settings.windowsShell
        if (currentShell?.type === 'wsl' && info.available) {
          const distroExists = info.distros.some(d => d.name === currentShell.distro)
          if (!distroExists) {
            const newSettings = { ...get().settings, windowsShell: { type: 'cmd' as const } }
            saveToStorage(newSettings)
            set({ settings: newSettings })
          }
        }
      } catch {
        // WSL detection failed - set as unavailable
        set({ wslInfo: { available: false, distros: [] } })
      }
    }
  }
}))
