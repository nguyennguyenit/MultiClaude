import { create } from 'zustand'
import type { AppSettings, ThemeMode, ColorTheme, TerminalLimit, TerminalRenderMode, WindowsShell, WslInfo, UiStyle, TerminalStyleOptions, TerminalFontId, ActivityBarState } from '@shared/types'
import { DEFAULT_SETTINGS } from '@shared/constants'
import { useToastStore } from './toast-store'

/**
 * Settings store for app-wide preferences with explicit Save/Cancel flow.
 *
 * Architecture:
 * - savedSettings: Last persisted state from disk (source of truth)
 * - pendingSettings: Working copy for live preview (not yet persisted)
 * - On Save: pendingSettings → disk → savedSettings
 * - On Cancel: savedSettings → pendingSettings (discard changes)
 *
 * Validation Strategy:
 * - Input validation happens in main process (SettingsStore.setSettings)
 * - Each field validated against allowed values (enums, ranges)
 * - Invalid values replaced with current valid values (not defaults)
 * - This prevents data corruption from malformed IPC payloads
 */

const STORAGE_KEY = 'multiclaude-settings' // For migration check

// Track if migration has been attempted this session (avoid repeated checks)
let migrationAttempted = false

interface SettingsState {
  // Persisted settings (source of truth from disk)
  savedSettings: AppSettings
  // Pending/preview settings (edited but not saved)
  pendingSettings: AppSettings
  // Backward-compatible alias for pendingSettings (used by components outside settings modal)
  settings: AppSettings
  // Track unsaved changes
  hasUnsavedChanges: boolean
  // UI state (not persisted)
  wslInfo: WslInfo | null
  gitPanelOpen: boolean
  settingsModalOpen: boolean

  // Pending setters (preview only, no persist)
  setThemeMode: (mode: ThemeMode) => void
  setColorTheme: (theme: ColorTheme) => void
  setGlassmorphismEnabled: (enabled: boolean) => void
  setTerminalLimit: (limit: TerminalLimit) => void
  setTerminalRenderMode: (mode: TerminalRenderMode) => void
  setWindowsShell: (shell: WindowsShell) => void
  setUiStyle: (style: UiStyle) => void
  setModernFontFamily: (fontId: TerminalFontId) => void
  setTerminalFontFamily: (fontId: TerminalFontId) => void
  setTerminalStyleOptions: (options: Partial<TerminalStyleOptions>) => void
  setActivityBarState: (state: ActivityBarState) => void

  // Actions
  saveSettings: () => Promise<void>      // Persist pending → saved
  cancelSettings: () => void             // Revert pending → saved
  loadSettings: () => Promise<void>      // Load from disk on startup

  // Helpers
  getTerminalLimitValue: () => number
  setGitPanelOpen: (open: boolean) => void
  setSettingsModalOpen: (open: boolean) => void
  detectWsl: () => Promise<void>
}

/**
 * Optimized deep equality check for AppSettings.
 * Compares individual fields instead of full JSON.stringify.
 * Handles undefined fields from old settings migration.
 */
function areSettingsEqual(a: AppSettings, b: AppSettings): boolean {
  // Compare primitive fields
  if (a.themeMode !== b.themeMode) return false
  if (a.colorTheme !== b.colorTheme) return false
  if (a.terminalRenderMode !== b.terminalRenderMode) return false
  if (a.glassmorphismEnabled !== b.glassmorphismEnabled) return false
  if (a.uiStyle !== b.uiStyle) return false
  if (a.modernFontFamily !== b.modernFontFamily) return false
  if (a.terminalFontFamily !== b.terminalFontFamily) return false
  if (a.activityBarState !== b.activityBarState) return false

  // Compare terminalLimit (with null safety for migration)
  const aLimit = a.terminalLimit
  const bLimit = b.terminalLimit
  if (aLimit?.preset !== bLimit?.preset) return false
  if (aLimit?.preset === 'custom' && bLimit?.preset === 'custom') {
    if (aLimit.customValue !== bLimit.customValue) return false
  }

  // Compare terminalStyleOptions
  const aStyle = a.terminalStyleOptions
  const bStyle = b.terminalStyleOptions
  if (aStyle?.colorPreset !== bStyle?.colorPreset) return false
  if (aStyle?.fontFamily !== bStyle?.fontFamily) return false
  if (aStyle?.useBorderChars !== bStyle?.useBorderChars) return false

  // Compare windowsShell
  const aShell = a.windowsShell
  const bShell = b.windowsShell
  if (!aShell && bShell) return false
  if (aShell && !bShell) return false
  if (aShell && bShell) {
    if (aShell.type !== bShell.type) return false
    if (aShell.type === 'wsl' && bShell.type === 'wsl') {
      if (aShell.distro !== bShell.distro) return false
    }
  }

  return true
}

export const useSettingsStore = create<SettingsState>((set, get) => ({
  savedSettings: DEFAULT_SETTINGS,
  pendingSettings: DEFAULT_SETTINGS,
  /**
   * @deprecated Use pendingSettings for preview state or savedSettings for persisted state.
   * This alias always returns pendingSettings for backward compatibility with legacy code.
   */
  get settings() { return get().pendingSettings },
  hasUnsavedChanges: false,
  wslInfo: null,
  gitPanelOpen: false,
  settingsModalOpen: false,

  // Pending setters - update preview only
  setThemeMode: (mode) => {
    const pending = { ...get().pendingSettings, themeMode: mode }
    set({
      pendingSettings: pending,
      hasUnsavedChanges: !areSettingsEqual(pending, get().savedSettings)
    })
  },

  setColorTheme: (theme) => {
    const pending = { ...get().pendingSettings, colorTheme: theme }
    set({
      pendingSettings: pending,
      hasUnsavedChanges: !areSettingsEqual(pending, get().savedSettings)
    })
  },

  setGlassmorphismEnabled: (enabled) => {
    const pending = { ...get().pendingSettings, glassmorphismEnabled: enabled }
    set({
      pendingSettings: pending,
      hasUnsavedChanges: !areSettingsEqual(pending, get().savedSettings)
    })
  },

  setTerminalLimit: (limit) => {
    const pending = { ...get().pendingSettings, terminalLimit: limit }
    set({
      pendingSettings: pending,
      hasUnsavedChanges: !areSettingsEqual(pending, get().savedSettings)
    })
  },

  setTerminalRenderMode: (mode) => {
    const pending = { ...get().pendingSettings, terminalRenderMode: mode }
    set({
      pendingSettings: pending,
      hasUnsavedChanges: !areSettingsEqual(pending, get().savedSettings)
    })
  },

  setWindowsShell: (shell) => {
    const pending = { ...get().pendingSettings, windowsShell: shell }
    set({
      pendingSettings: pending,
      hasUnsavedChanges: !areSettingsEqual(pending, get().savedSettings)
    })
  },

  setUiStyle: (style) => {
    const pending = { ...get().pendingSettings, uiStyle: style }
    set({
      pendingSettings: pending,
      hasUnsavedChanges: !areSettingsEqual(pending, get().savedSettings)
    })
  },

  setModernFontFamily: (fontId) => {
    const pending = { ...get().pendingSettings, modernFontFamily: fontId }
    set({
      pendingSettings: pending,
      hasUnsavedChanges: !areSettingsEqual(pending, get().savedSettings)
    })
  },

  setTerminalFontFamily: (fontId) => {
    const pending = { ...get().pendingSettings, terminalFontFamily: fontId }
    set({
      pendingSettings: pending,
      hasUnsavedChanges: !areSettingsEqual(pending, get().savedSettings)
    })
  },

  setTerminalStyleOptions: (options) => {
    const pending = {
      ...get().pendingSettings,
      terminalStyleOptions: {
        ...get().pendingSettings.terminalStyleOptions,
        ...options
      }
    }
    set({
      pendingSettings: pending,
      hasUnsavedChanges: !areSettingsEqual(pending, get().savedSettings)
    })
  },

  setActivityBarState: (state) => {
    const pending = { ...get().pendingSettings, activityBarState: state }
    set({
      pendingSettings: pending,
      hasUnsavedChanges: !areSettingsEqual(pending, get().savedSettings)
    })
  },

  // Save: persist pending to disk, update saved state
  saveSettings: async () => {
    const pending = get().pendingSettings
    console.log('[settings] Saving settings:', pending)
    try {
      const result = await window.electron.settings.set(pending)
      console.log('[settings] Save result from main:', result)
      set({
        savedSettings: pending,
        hasUnsavedChanges: false
      })
      console.log('[settings] savedSettings updated to:', get().savedSettings)
    } catch (err) {
      console.error('Failed to save settings:', err)
      throw err
    }
  },

  // Cancel: revert pending to saved
  cancelSettings: () => {
    set({
      pendingSettings: { ...get().savedSettings },
      hasUnsavedChanges: false
    })
  },

  // Load from disk on startup
  loadSettings: async () => {
    try {
      const settings = await window.electron.settings.get()
      console.log('[settings] Loaded from disk:', settings)
      set({
        savedSettings: settings,
        pendingSettings: settings,
        hasUnsavedChanges: false
      })

      // One-time migration from localStorage (only try once per session)
      if (!migrationAttempted) {
        migrationAttempted = true
        const oldData = localStorage.getItem(STORAGE_KEY)
        if (oldData) {
          try {
            const parsed = JSON.parse(oldData)
            const merged = { ...settings, ...parsed }
            await window.electron.settings.set(merged)
            set({
              savedSettings: merged,
              pendingSettings: merged
            })
            localStorage.removeItem(STORAGE_KEY)
          } catch (migrationErr) {
            // Log migration errors for debugging but don't fail the app
            console.warn('[settings] localStorage migration failed:', migrationErr)
          }
        }
      }
    } catch (err) {
      console.error('Failed to load settings from disk:', err)
      useToastStore.getState().addToast(
        'Failed to load settings. Using defaults.',
        'warning'
      )
      set({
        savedSettings: DEFAULT_SETTINGS,
        pendingSettings: DEFAULT_SETTINGS
      })
    }
  },

  getTerminalLimitValue: () => {
    const { terminalLimit } = get().pendingSettings
    if (!terminalLimit) return 9
    if (terminalLimit.preset === 'custom') {
      return terminalLimit.customValue ?? 9
    }
    return terminalLimit.preset
  },

  setGitPanelOpen: (open) => set({ gitPanelOpen: open }),

  setSettingsModalOpen: (open) => {
    if (open) {
      // Reset pending to saved when opening modal
      set({
        settingsModalOpen: true,
        pendingSettings: { ...get().savedSettings },
        hasUnsavedChanges: false
      })
    } else {
      set({ settingsModalOpen: false })
    }
  },

  detectWsl: async () => {
    if (typeof window !== 'undefined' && window.electron?.terminal?.detectWsl) {
      try {
        const info = await window.electron.terminal.detectWsl()
        if (!info) return
        set({ wslInfo: info })

        const currentShell = get().pendingSettings.windowsShell
        if (currentShell?.type === 'wsl' && info.available) {
          const distroExists = info.distros.some(d => d.name === currentShell.distro)
          if (!distroExists) {
            const pending = { ...get().pendingSettings, windowsShell: { type: 'cmd' as const } }
            set({ pendingSettings: pending })
          }
        }
      } catch {
        set({ wslInfo: { available: false, distros: [] } })
      }
    }
  }
}))
