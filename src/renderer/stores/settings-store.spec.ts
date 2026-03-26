import { beforeEach, describe, expect, it } from 'vitest'
import { DEFAULT_SETTINGS } from '@shared/constants'
import type { AppSettings } from '@shared/types'
import { useSettingsStore } from './settings-store'

function cloneDefaultSettings(): AppSettings {
  return structuredClone(DEFAULT_SETTINGS)
}

describe('useSettingsStore', () => {
  beforeEach(() => {
    const settings = cloneDefaultSettings()
    useSettingsStore.setState({
      savedSettings: settings,
      pendingSettings: settings,
      hasUnsavedChanges: false,
      wslInfo: null,
      gitPanelOpen: false,
      settingsModalOpen: false
    })
  })

  it('keeps the settings alias in sync with pending terminalRenderMode updates', () => {
    useSettingsStore.getState().setTerminalRenderMode('performance')

    expect(useSettingsStore.getState().pendingSettings.terminalRenderMode).toBe('performance')
    expect(useSettingsStore.getState().settings.terminalRenderMode).toBe('performance')
  })
})
