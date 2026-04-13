import Store from 'electron-store'
import type { AppSettings, ThemeMode, ColorTheme, TerminalRenderMode, UiStyle, TerminalColorPreset, TerminalFontId, AppFontId } from '@shared/types'
import { DEFAULT_SETTINGS } from '@shared/constants'

interface StoreSchema {
  settings: AppSettings
}

// Allowed values for enum-like settings
const VALID_THEME_MODES: ThemeMode[] = ['light', 'dark', 'system']
const VALID_COLOR_THEMES: ColorTheme[] = ['default', 'dusk', 'lime', 'ocean', 'retro', 'neo', 'forest', 'neon-cyber', 'pro-dark', 'vibrant']
const VALID_RENDER_MODES: TerminalRenderMode[] = ['performance', 'balanced', 'quality']
const VALID_TERMINAL_PRESETS = [2, 4, 9, 'custom'] as const
const VALID_UI_STYLES: UiStyle[] = ['modern', 'terminal']
const VALID_TERMINAL_COLOR_PRESETS: TerminalColorPreset[] = ['green', 'blue', 'white']
const VALID_TERMINAL_FONT_IDS: TerminalFontId[] = ['system', 'jetbrains-mono', 'source-code-pro', 'fira-code', 'vt323', 'ibm-plex-mono', 'space-mono']
const VALID_APP_FONT_IDS: AppFontId[] = ['system', 'inter', 'geist', 'plus-jakarta-sans', 'roboto', 'ubuntu', 'segoe-ui']

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

  if (settings.gpuRendererForClaudeTerminals !== undefined) {
    validated.gpuRendererForClaudeTerminals =
      typeof settings.gpuRendererForClaudeTerminals === 'boolean'
        ? settings.gpuRendererForClaudeTerminals
        : defaults.gpuRendererForClaudeTerminals
  }

  // Validate glassmorphismEnabled
  if (settings.glassmorphismEnabled !== undefined) {
    validated.glassmorphismEnabled = typeof settings.glassmorphismEnabled === 'boolean'
      ? settings.glassmorphismEnabled
      : defaults.glassmorphismEnabled
  }

  // Validate terminalFontFamily
  if (settings.terminalFontFamily !== undefined) {
    validated.terminalFontFamily = VALID_TERMINAL_FONT_IDS.includes(settings.terminalFontFamily as TerminalFontId)
      ? settings.terminalFontFamily as TerminalFontId
      : defaults.terminalFontFamily
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

  // Validate modernFontFamily
  if (settings.modernFontFamily !== undefined) {
    validated.modernFontFamily = VALID_APP_FONT_IDS.includes(settings.modernFontFamily as AppFontId)
      ? settings.modernFontFamily as AppFontId
      : defaults.modernFontFamily
  }

  // Validate uiStyle
  if (settings.uiStyle !== undefined) {
    validated.uiStyle = VALID_UI_STYLES.includes(settings.uiStyle)
      ? settings.uiStyle
      : defaults.uiStyle
  }

  // Validate terminalStyleOptions
  if (settings.terminalStyleOptions !== undefined) {
    const opts = settings.terminalStyleOptions
    const defaultOpts = defaults.terminalStyleOptions ?? {
      colorPreset: 'green' as TerminalColorPreset,
      fontFamily: 'jetbrains-mono' as TerminalFontId,
      useBorderChars: false
    }
    if (opts && typeof opts === 'object') {
      validated.terminalStyleOptions = {
        colorPreset: VALID_TERMINAL_COLOR_PRESETS.includes(opts.colorPreset)
          ? opts.colorPreset
          : defaultOpts.colorPreset,
        fontFamily: VALID_TERMINAL_FONT_IDS.includes(opts.fontFamily)
          ? opts.fontFamily
          : defaultOpts.fontFamily,
        useBorderChars: typeof opts.useBorderChars === 'boolean'
          ? opts.useBorderChars
          : defaultOpts.useBorderChars
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
      terminalStyleOptions: validated.terminalStyleOptions
        ? { ...current.terminalStyleOptions, ...validated.terminalStyleOptions }
        : current.terminalStyleOptions,
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
