import { beforeEach, describe, expect, it, vi } from 'vitest'
import { DEFAULT_SETTINGS } from '@shared/constants'
import type { AppSettings, ShellInfo } from '@shared/types'
import { useSettingsStore } from './settings-store'

function cloneDefaultSettings(): AppSettings {
  return structuredClone(DEFAULT_SETTINGS)
}

const settingsSet = vi.fn()
const zsh: ShellInfo = { path: '/bin/zsh', name: 'zsh', isDefault: true, kind: 'unix' }

describe('useSettingsStore', () => {
  beforeEach(() => {
    settingsSet.mockReset().mockResolvedValue(undefined)
    Object.defineProperty(globalThis, 'window', {
      value: {
        electron: {
          settings: {
            set: settingsSet
          }
        }
      },
      configurable: true,
      writable: true
    })

    const settings = cloneDefaultSettings()
    useSettingsStore.setState({
      savedSettings: settings,
      pendingSettings: settings,
      settings,
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

  it('keeps all settings snapshots in sync when persisting the default shell', async () => {
    await useSettingsStore.getState().setDefaultShell(zsh)

    expect(settingsSet).toHaveBeenCalledWith({ defaultShell: zsh })
    expect(useSettingsStore.getState().savedSettings.defaultShell).toEqual(zsh)
    expect(useSettingsStore.getState().pendingSettings.defaultShell).toEqual(zsh)
    expect(useSettingsStore.getState().settings.defaultShell).toEqual(zsh)
  })

  it('marks settings as unsaved when scrollbackLines is changed', () => {
    useSettingsStore.getState().setScrollbackLines(50_000)

    expect(useSettingsStore.getState().pendingSettings.scrollbackLines).toBe(50_000)
    expect(useSettingsStore.getState().settings.scrollbackLines).toBe(50_000)
    expect(useSettingsStore.getState().hasUnsavedChanges).toBe(true)
  })
})
