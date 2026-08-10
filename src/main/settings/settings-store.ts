import Store from 'electron-store'
import { app } from 'electron'
import type { AppSettings, ThemeMode, TerminalRendererPolicy, TerminalFontId, AppFontId, ShellInfo, TerminalEngine } from '@shared/types'
import { DEFAULT_SETTINGS, SCROLLBACK_MIN, SCROLLBACK_MAX, THEMES } from '@shared/constants'
import { getNativeTerminalCapability, resolveTerminalEngine } from '../terminal/native-terminal-capability'
import { CURRENT_SETTINGS_SCHEMA_VERSION, migrateSettings } from './settings-migrations'
import {
  beginSettingsMigration,
  confirmSettingsMigrationReady,
  recoverSettingsMigrationOnLaunch,
  type SettingsMigrationTransaction,
} from './settings-migration-transaction'

/**
 * Detect whether the current build is on a pre-release channel
 * (beta / rc / alpha) — drives channel-aware defaults for
 * enableContextWindowAdvanced. Falls back to stable if app.getVersion()
 * is unavailable (non-Electron contexts, e.g. tests).
 */
function isPreReleaseChannel(appVersion?: string): boolean {
  try {
    return /-(beta|rc|alpha)/i.test(appVersion ?? app.getVersion())
  } catch {
    return false
  }
}

interface StoreSchema {
  settings?: AppSettings
  settingsMigration: SettingsMigrationTransaction | null
}

interface SettingsStoreOptions {
  /** Test seam; production reads Electron's app version. */
  appVersion?: string
}

// Allowed values for enum-like settings
const VALID_THEME_MODES: ThemeMode[] = ['light', 'dark', 'system']
const VALID_COLOR_THEMES = new Set(THEMES.map(theme => theme.id))
const VALID_RENDERER_POLICIES: TerminalRendererPolicy[] = ['automatic', 'prefer-gpu', 'safe-dom']
const VALID_TERMINAL_PRESETS = [2, 4, 9, 'custom'] as const
const VALID_TERMINAL_FONT_IDS: TerminalFontId[] = ['system', 'jetbrains-mono', 'source-code-pro', 'fira-code', 'vt323', 'ibm-plex-mono', 'space-mono']
const VALID_APP_FONT_IDS: AppFontId[] = ['system', 'inter', 'geist', 'plus-jakarta-sans', 'roboto', 'ubuntu', 'segoe-ui']
const VALID_SHELL_KINDS: ShellInfo['kind'][] = ['unix', 'cmd', 'powershell', 'wsl']

/**
 * Validate and sanitize incoming settings to prevent data corruption.
 * Returns sanitized settings with invalid values replaced by defaults.
 */
export function validateSettings(settings: Partial<AppSettings>, defaults: AppSettings): Partial<AppSettings> {
  const validated: Partial<AppSettings> = {}

  // Validate themeMode
  if (settings.themeMode !== undefined) {
    validated.themeMode = VALID_THEME_MODES.includes(settings.themeMode)
      ? settings.themeMode
      : defaults.themeMode
  }

  // Validate colorTheme
  if (settings.colorTheme !== undefined) {
    validated.colorTheme = VALID_COLOR_THEMES.has(settings.colorTheme)
      ? settings.colorTheme
      : defaults.colorTheme
  }

  if (settings.settingsSchemaVersion !== undefined) {
    validated.settingsSchemaVersion = CURRENT_SETTINGS_SCHEMA_VERSION
  }

  if (settings.terminalEngine !== undefined) {
    validated.terminalEngine = resolveTerminalEngine(
      settings.terminalEngine as TerminalEngine,
      getNativeTerminalCapability(),
    )
  }

  if (settings.terminalRendererPolicy !== undefined) {
    validated.terminalRendererPolicy = VALID_RENDERER_POLICIES.includes(
      settings.terminalRendererPolicy,
    )
      ? settings.terminalRendererPolicy
      : defaults.terminalRendererPolicy
  }

  // Validate scrollbackLines (clamp to allowed range; fall back to default on non-numeric input)
  if (settings.scrollbackLines !== undefined) {
    const raw = settings.scrollbackLines
    if (typeof raw === 'number' && Number.isFinite(raw)) {
      const clamped = Math.min(SCROLLBACK_MAX, Math.max(SCROLLBACK_MIN, Math.floor(raw)))
      validated.scrollbackLines = clamped
    } else {
      validated.scrollbackLines = defaults.scrollbackLines
    }
  }

  // Validate enableContextWindow
  if (settings.enableContextWindow !== undefined) {
    validated.enableContextWindow = typeof settings.enableContextWindow === 'boolean'
      ? settings.enableContextWindow
      : defaults.enableContextWindow
  }

  // Validate enableContextWindowAdvanced
  if (settings.enableContextWindowAdvanced !== undefined) {
    validated.enableContextWindowAdvanced = typeof settings.enableContextWindowAdvanced === 'boolean'
      ? settings.enableContextWindowAdvanced
      : defaults.enableContextWindowAdvanced
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

  if (settings.defaultShell !== undefined) {
    const shell = settings.defaultShell
    if (
      shell &&
      typeof shell.path === 'string' &&
      shell.path.length > 0 &&
      typeof shell.name === 'string' &&
      shell.name.length > 0 &&
      typeof shell.isDefault === 'boolean' &&
      VALID_SHELL_KINDS.includes(shell.kind) &&
      (shell.kind !== 'wsl' || typeof shell.distro === 'string')
    ) {
      validated.defaultShell = {
        path: shell.path,
        name: shell.name,
        isDefault: shell.isDefault,
        kind: shell.kind,
        ...(shell.kind === 'wsl' ? { distro: shell.distro } : {}),
      }
    }
  }

  // Validate modernFontFamily
  if (settings.modernFontFamily !== undefined) {
    validated.modernFontFamily = VALID_APP_FONT_IDS.includes(settings.modernFontFamily as AppFontId)
      ? settings.modernFontFamily as AppFontId
      : defaults.modernFontFamily
  }

  return validated
}

/**
 * Electron-store based settings persistence for main process.
 * Stores settings to disk at %APPDATA%/multiclaude/multiclaude-settings.json (Windows).
 */
export class SettingsStore {
  private store: Store<StoreSchema>
  private readonly channelDefaults: AppSettings

  constructor(options: SettingsStoreOptions = {}) {
    this.channelDefaults = {
      ...DEFAULT_SETTINGS,
      enableContextWindowAdvanced: isPreReleaseChannel(options.appVersion),
    }
    const cwd = process.env.MULTICLAUDE_TEST_STORE_PATH || undefined

    this.store = new Store<StoreSchema>({
      name: 'multiclaude-settings',
      cwd,
      defaults: {
        settingsMigration: null,
      }
    })
    this.prepareSettings()
  }

  private prepareSettings(): void {
    const raw = (this.store.get('settings') ?? {}) as unknown as Record<string, unknown>
    const transaction = this.store.get('settingsMigration')
    const recovered = recoverSettingsMigrationOnLaunch(raw, transaction)
    if (transaction) {
      if (!recovered.restoredBackup) {
        this.store.set('settingsMigration', recovered.transaction)
        if (recovered.transaction?.phase === 'next-launch-expiry-pending') return
      }
    }

    const migrated = {
      ...this.channelDefaults,
      ...migrateSettings(recovered.settings),
      settingsSchemaVersion: CURRENT_SETTINGS_SCHEMA_VERSION,
    } as AppSettings
    const candidateSettings = {
      ...this.channelDefaults,
      ...validateSettings(migrated, this.channelDefaults),
      settingsSchemaVersion: CURRENT_SETTINGS_SCHEMA_VERSION,
    } as AppSettings
    candidateSettings.terminalEngine = resolveTerminalEngine(candidateSettings.terminalEngine)
    if (JSON.stringify(recovered.settings) === JSON.stringify(candidateSettings)) return

    const backup = structuredClone(recovered.settings)
    const candidate = structuredClone(candidateSettings) as unknown as Record<string, unknown>
    try {
      this.store.set('settingsMigration', {
        phase: 'backup-written',
        backup,
        candidate,
      })
      this.store.set('settingsMigration', beginSettingsMigration(backup, candidate))
      this.store.set('settings', candidateSettings)

      const persistedCandidate = this.store.get('settings')
      const readValidated = {
        ...this.channelDefaults,
        ...validateSettings(persistedCandidate ?? {}, this.channelDefaults),
        settingsSchemaVersion: CURRENT_SETTINGS_SCHEMA_VERSION,
      } as AppSettings
      readValidated.terminalEngine = resolveTerminalEngine(readValidated.terminalEngine)
      if (
        JSON.stringify(persistedCandidate) !== JSON.stringify(candidateSettings) ||
        JSON.stringify(readValidated) !== JSON.stringify(candidateSettings)
      ) {
        throw new Error('candidate verification mismatch')
      }
    } catch {
      throw new Error('Settings migration failed; restart MultiClaude to retry.')
    }
  }

  /** Retrieve current settings from disk, applying channel-aware defaults
   *  for any fields missing from the persisted payload (e.g. v3.5.0 users
   *  upgrading to v3.6.0). Writes back once so subsequent reads are stable.
   */
  getSettings(): AppSettings {
    return this.store.get('settings') ?? structuredClone(this.channelDefaults)
  }

  private completeSettingsProfile(settings: Record<string, unknown>): AppSettings {
    return {
      ...structuredClone(this.channelDefaults),
      ...structuredClone(settings),
    } as AppSettings
  }

  /**
   * Update settings with partial values.
   * Validates input and uses deep merge for nested objects.
   */
  setSettings(settings: Partial<AppSettings>): AppSettings {
    const current = this.getSettings()
    const shouldClearDefaultShell = Object.prototype.hasOwnProperty.call(settings, 'defaultShell')
      && settings.defaultShell === undefined
    // Validate input before merging
    const migratedInput = migrateSettings(
      settings as unknown as Record<string, unknown>,
    ) as Partial<AppSettings>
    const validated = validateSettings(migratedInput, current)
    const updated: AppSettings = {
      ...current,
      ...validated,
      // Deep merge nested objects
      terminalLimit: validated.terminalLimit
        ? { ...current.terminalLimit, ...validated.terminalLimit }
        : current.terminalLimit,
      settingsSchemaVersion: CURRENT_SETTINGS_SCHEMA_VERSION,
    }
    if (shouldClearDefaultShell) {
      delete updated.defaultShell
    }
    const sanitized = migrateSettings(updated as unknown as Record<string, unknown>) as unknown as AppSettings
    sanitized.terminalEngine = resolveTerminalEngine(sanitized.terminalEngine)
    this.store.set('settings', sanitized)
    return sanitized
  }

  markMigrationHealthy(): void {
    const transaction = this.store.get('settingsMigration')
    if (!transaction || transaction.phase === 'app-ready-confirmed') return
    this.store.set('settingsMigration', confirmSettingsMigrationReady(transaction))
  }

  /** Reset all settings to defaults. */
  resetSettings(): AppSettings {
    const defaults = structuredClone(this.channelDefaults)
    this.store.set('settings', defaults)
    return defaults
  }
}
