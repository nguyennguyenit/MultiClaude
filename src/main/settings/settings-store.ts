import Store from 'electron-store'
import type { AppSettings, ThemeMode, ColorTheme, TerminalRenderMode } from '@shared/types'
import { DEFAULT_SETTINGS } from '@shared/constants'

interface StoreSchema {
  settings: AppSettings
}

// Allowed values for enum-like settings
const VALID_THEME_MODES: ThemeMode[] = ['light', 'dark', 'system']
const VALID_COLOR_THEMES: ColorTheme[] = ['default', 'dusk', 'lime', 'ocean', 'retro', 'neo', 'forest', 'neon-cyber', 'pro-dark', 'vibrant']
const VALID_RENDER_MODES: TerminalRenderMode[] = ['performance', 'balanced', 'quality']
const VALID_TERMINAL_PRESETS = [2, 4, 9, 'custom'] as const

/**
 * Validate and sanitize incoming settings to prevent data corruption.
 * Returns sanitized settings with invalid values replaced by defaults.
 */
function validateSettings(settings: Partial<AppSettings>, defaults: AppSettings): Partial<AppSettings> {
  const validated: Partial<AppSettings> = {}

  // Validate themeMode
  if (settings.themeMode !== undefined) {
    validated.themeMode = VALID_THEME_MODES.includes(settings.themeMode)
      ? settings.themeMode
      : defaults.themeMode
  }

  // Validate colorTheme
  if (settings.colorTheme !== undefined) {
    validated.colorTheme = VALID_COLOR_THEMES.includes(settings.colorTheme)
      ? settings.colorTheme
      : defaults.colorTheme
  }

  // Validate terminalRenderMode
  if (settings.terminalRenderMode !== undefined) {
    validated.terminalRenderMode = VALID_RENDER_MODES.includes(settings.terminalRenderMode)
      ? settings.terminalRenderMode
      : defaults.terminalRenderMode
  }

  // Validate glassmorphismEnabled
  if (settings.glassmorphismEnabled !== undefined) {
    validated.glassmorphismEnabled = typeof settings.glassmorphismEnabled === 'boolean'
      ? settings.glassmorphismEnabled
      : defaults.glassmorphismEnabled
  }

  // Validate terminalLimit
  if (settings.terminalLimit !== undefined) {
    const limit = settings.terminalLimit
    if (limit && typeof limit === 'object' && 'preset' in limit) {
      const isValidPreset = VALID_TERMINAL_PRESETS.includes(limit.preset as typeof VALID_TERMINAL_PRESETS[number])
      if (isValidPreset) {
        if (limit.preset === 'custom') {
          const customVal = limit.customValue
          validated.terminalLimit = {
            preset: 'custom',
            customValue: typeof customVal === 'number' && customVal >= 1 && customVal <= 99
              ? customVal
              : 9
          }
        } else {
          validated.terminalLimit = { preset: limit.preset as 2 | 4 | 9 }
        }
      }
    }
  }

  // Validate windowsShell
  if (settings.windowsShell !== undefined) {
    const shell = settings.windowsShell
    if (shell && typeof shell === 'object' && 'type' in shell) {
      if (shell.type === 'cmd' || shell.type === 'powershell') {
        validated.windowsShell = { type: shell.type }
      } else if (shell.type === 'wsl' && typeof shell.distro === 'string' && shell.distro.length > 0) {
        validated.windowsShell = { type: 'wsl', distro: shell.distro }
      }
    }
  }

  return validated
}

/**
 * Electron-store based settings persistence for main process.
 * Stores settings to disk at %APPDATA%/multiclaude/multiclaude-settings.json (Windows).
 */
export class SettingsStore {
  private store: Store<StoreSchema>

  constructor() {
    const cwd = process.env.MULTICLAUDE_TEST_STORE_PATH || undefined

    this.store = new Store<StoreSchema>({
      name: 'multiclaude-settings',
      cwd,
      defaults: {
        settings: DEFAULT_SETTINGS
      }
    })
  }

  /** Retrieve current settings from disk. */
  getSettings(): AppSettings {
    return this.store.get('settings')
  }

  /**
   * Update settings with partial values.
   * Validates input and uses deep merge for nested objects.
   */
  setSettings(settings: Partial<AppSettings>): AppSettings {
    const current = this.getSettings()
    // Validate input before merging
    const validated = validateSettings(settings, current)
    const updated: AppSettings = {
      ...current,
      ...validated,
      // Deep merge nested objects
      terminalLimit: validated.terminalLimit
        ? { ...current.terminalLimit, ...validated.terminalLimit }
        : current.terminalLimit,
      windowsShell: validated.windowsShell ?? current.windowsShell
    }
    this.store.set('settings', updated)
    return updated
  }

  /** Reset all settings to defaults. */
  resetSettings(): AppSettings {
    this.store.set('settings', DEFAULT_SETTINGS)
    return DEFAULT_SETTINGS
  }
}
