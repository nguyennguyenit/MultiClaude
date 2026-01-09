import Store from 'electron-store'
import type { AppSettings } from '@shared/types'
import { DEFAULT_SETTINGS } from '@shared/constants'

interface StoreSchema {
  settings: AppSettings
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
   * Uses deep merge for nested objects (terminalLimit, windowsShell).
   */
  setSettings(settings: Partial<AppSettings>): AppSettings {
    const current = this.getSettings()
    const updated: AppSettings = {
      ...current,
      ...settings,
      // Deep merge nested objects
      terminalLimit: settings.terminalLimit
        ? { ...current.terminalLimit, ...settings.terminalLimit }
        : current.terminalLimit,
      windowsShell: settings.windowsShell ?? current.windowsShell
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
