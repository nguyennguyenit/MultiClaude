import { create } from 'zustand'
import type { AppSettings, ThemeMode, ColorTheme, TerminalLimit, TerminalRenderMode, TerminalEngine, WslInfo, TerminalFontId, AppFontId, ShellInfo } from '@shared/types'
import { DEFAULT_SETTINGS, APP_FONTS } from '@shared/constants'
import { useToastStore } from './toast-store'

/** Apply app/UI font immediately to DOM (both CSS variable and body inline style) */
function applyAppFont(fontId: AppFontId): void {
  const font = APP_FONTS.find(f => f.id === fontId)
  if (!font) return
  document.documentElement.style.setProperty('--modern-font', font.family)
  document.body.style.fontFamily = font.family
}

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
  setTerminalLimit: (limit: TerminalLimit) => void
  setTerminalRenderMode: (mode: TerminalRenderMode) => void
  setTerminalEngine: (engine: TerminalEngine) => void
  setGpuRendererForClaudeTerminals: (enabled: boolean) => void
  setScrollbackLines: (lines: number) => void
  setEnableContextWindow: (enabled: boolean) => void
  setEnableContextWindowAdvanced: (enabled: boolean) => void
  setDefaultShell: (shell: ShellInfo | null) => Promise<void>
  setModernFontFamily: (fontId: AppFontId) => void
  setTerminalFontFamily: (fontId: TerminalFontId) => void
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
  if (a.gpuRendererForClaudeTerminals !== b.gpuRendererForClaudeTerminals) return false
  if (a.scrollbackLines !== b.scrollbackLines) return false
  if (a.modernFontFamily !== b.modernFontFamily) return false
  if (a.terminalFontFamily !== b.terminalFontFamily) return false
  if (a.enableContextWindow !== b.enableContextWindow) return false
  if (a.enableContextWindowAdvanced !== b.enableContextWindowAdvanced) return false
  // Compare terminalLimit (with null safety for migration)
  const aLimit = a.terminalLimit
  const bLimit = b.terminalLimit
  if (aLimit?.preset !== bLimit?.preset) return false
  if (aLimit?.preset === 'custom' && bLimit?.preset === 'custom') {
    if (aLimit.customValue !== bLimit.customValue) return false
  }

  if (a.terminalEngine !== b.terminalEngine) return false
  if (JSON.stringify(a.defaultShell) !== JSON.stringify(b.defaultShell)) return false

  return true
}

/**
 * Legacy renderer storage is only authoritative when main still has an
 * untouched default profile. A current main-owned preference always wins.
 */
export function shouldImportLegacySettings(mainSettings: AppSettings): boolean {
  return areSettingsEqual(mainSettings, DEFAULT_SETTINGS)
}

export const useSettingsStore = create<SettingsState>((set, get) => ({
  savedSettings: DEFAULT_SETTINGS,
  pendingSettings: DEFAULT_SETTINGS,
  /**
   * @deprecated Use pendingSettings for preview state or savedSettings for persisted state.
   * Kept as a synchronized alias for backward compatibility with legacy code.
   */
  settings: DEFAULT_SETTINGS,
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

  setTerminalEngine: (engine) => {
    const pending = { ...get().pendingSettings, terminalEngine: engine }
    set({
      pendingSettings: pending,
      hasUnsavedChanges: !areSettingsEqual(pending, get().savedSettings)
    })
  },

  setGpuRendererForClaudeTerminals: (enabled) => {
    const pending = { ...get().pendingSettings, gpuRendererForClaudeTerminals: enabled }
    set({
      pendingSettings: pending,
      hasUnsavedChanges: !areSettingsEqual(pending, get().savedSettings)
    })
  },

  setScrollbackLines: (lines) => {
    const pending = { ...get().pendingSettings, scrollbackLines: lines }
    set({
      pendingSettings: pending,
      hasUnsavedChanges: !areSettingsEqual(pending, get().savedSettings)
    })
  },

  setEnableContextWindow: (enabled) => {
    const pending = { ...get().pendingSettings, enableContextWindow: enabled }
    set({
      pendingSettings: pending,
      hasUnsavedChanges: !areSettingsEqual(pending, get().savedSettings)
    })
  },

  setEnableContextWindowAdvanced: (enabled) => {
    const pending = { ...get().pendingSettings, enableContextWindowAdvanced: enabled }
    set({
      pendingSettings: pending,
      hasUnsavedChanges: !areSettingsEqual(pending, get().savedSettings)
    })
  },

  // Persist selected shell to disk immediately (cross-platform shell persistence)
  setDefaultShell: async (shell) => {
    const saved = get().savedSettings
    try {
      const updated = await window.electron.settings.set({ defaultShell: shell ?? undefined })
      set({
        savedSettings: updated,
        pendingSettings: updated,
        settings: updated,
        hasUnsavedChanges: false
      })
    } catch (err) {
      console.error('[settings] Failed to persist defaultShell:', err)
      set({
        savedSettings: saved,
        pendingSettings: saved,
        settings: saved,
        hasUnsavedChanges: false
      })
    }
  },

  setModernFontFamily: (fontId) => {
    const pending = { ...get().pendingSettings, modernFontFamily: fontId }
    set({
      pendingSettings: pending,
      hasUnsavedChanges: !areSettingsEqual(pending, get().savedSettings)
    })
    // Apply immediately to DOM so preview is instant and independent of React render cycle
    applyAppFont(fontId)
  },

  setTerminalFontFamily: (fontId) => {
    const pending = { ...get().pendingSettings, terminalFontFamily: fontId }
    set({
      pendingSettings: pending,
      hasUnsavedChanges: !areSettingsEqual(pending, get().savedSettings)
    })
  },

  // Save: persist pending to disk, update saved state
  saveSettings: async () => {
    const pending = get().pendingSettings
    const saved = get().savedSettings
    console.log('[settings] Saving settings:', pending)
    try {
      const result = await window.electron.settings.set(pending)
      console.log('[settings] Save result from main:', result)
      set({
        savedSettings: result,
        pendingSettings: result,
        settings: result,
        hasUnsavedChanges: false
      })
      if (result.modernFontFamily) applyAppFont(result.modernFontFamily)
      console.log('[settings] savedSettings updated to:', get().savedSettings)
    } catch (err) {
      console.error('Failed to save settings:', err)
      set({
        savedSettings: saved,
        pendingSettings: saved,
        settings: saved,
        hasUnsavedChanges: false
      })
      if (saved.modernFontFamily) applyAppFont(saved.modernFontFamily)
      throw err
    }
  },

  // Cancel: revert pending to saved
  cancelSettings: () => {
    const saved = get().savedSettings
    set({
      pendingSettings: { ...saved },
      hasUnsavedChanges: false
    })
    if (saved.modernFontFamily) applyAppFont(saved.modernFontFamily)
  },

  // Load from disk on startup
  loadSettings: async () => {
    try {
      const settings = await window.electron.settings.get()
      set({
        savedSettings: settings,
        pendingSettings: settings,
        settings,
        hasUnsavedChanges: false
      })

      // Apply saved app font to DOM on initial load
      if (settings.modernFontFamily) {
        applyAppFont(settings.modernFontFamily)
      }

      // One-time migration from localStorage (only try once per session)
      if (!migrationAttempted) {
        migrationAttempted = true
        const oldData = localStorage.getItem(STORAGE_KEY)
        if (oldData) {
          if (!shouldImportLegacySettings(settings)) {
            localStorage.removeItem(STORAGE_KEY)
            return
          }
          try {
            const parsed = JSON.parse(oldData)
            const migrated = await window.electron.settings.set(parsed)
            set({
              savedSettings: migrated,
              pendingSettings: migrated,
              settings: migrated,
              hasUnsavedChanges: false
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

        const currentShell = get().pendingSettings.defaultShell
        if (currentShell?.kind === 'wsl' && info.available) {
          const distroExists = info.distros.some(d => d.name === currentShell.distro)
          if (!distroExists) {
            void get().setDefaultShell({
              path: 'cmd.exe',
              name: 'Command Prompt',
              isDefault: true,
              kind: 'cmd'
            })
          }
        }
      } catch {
        set({ wslInfo: { available: false, distros: [] } })
      }
    }
  }
}))

useSettingsStore.subscribe((state) => {
  if (state.settings !== state.pendingSettings) {
    useSettingsStore.setState({ settings: state.pendingSettings })
  }
})
