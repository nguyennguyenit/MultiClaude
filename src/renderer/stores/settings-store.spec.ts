import { beforeEach, describe, expect, it, vi } from 'vitest'
import { DEFAULT_SETTINGS } from '@shared/constants'
import type { AppSettings, ShellInfo } from '@shared/types'
import { shouldImportLegacySettings, useSettingsStore } from './settings-store'

function cloneDefaultSettings(): AppSettings {
  return structuredClone(DEFAULT_SETTINGS)
}

const settingsSet = vi.fn()
const zsh: ShellInfo = { path: '/bin/zsh', name: 'zsh', isDefault: true, kind: 'unix' }

describe('useSettingsStore', () => {
  beforeEach(() => {
    settingsSet.mockReset().mockImplementation(async (partial: Partial<AppSettings>) => ({
      ...cloneDefaultSettings(),
      ...partial,
    }))
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
    Object.defineProperty(globalThis, 'document', {
      value: {
        documentElement: { style: { setProperty: vi.fn() } },
        body: { style: { fontFamily: '' } }
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

  it('preserves pending edits while an immediate shell persistence request is in flight', async () => {
    const persisted = { ...cloneDefaultSettings(), defaultShell: zsh }
    useSettingsStore.setState({
      savedSettings: persisted,
      pendingSettings: persisted,
      settings: persisted,
    })

    let resolvePersistence!: (settings: AppSettings) => void
    settingsSet.mockReturnValueOnce(new Promise<AppSettings>((resolve) => {
      resolvePersistence = resolve
    }))

    const persistence = useSettingsStore.getState().setDefaultShell(null)
    useSettingsStore.getState().setThemeMode('light')
    resolvePersistence(cloneDefaultSettings())
    await persistence

    expect(settingsSet).toHaveBeenCalledWith({ defaultShell: undefined })
    expect(useSettingsStore.getState().savedSettings.defaultShell).toBeUndefined()
    expect(useSettingsStore.getState().pendingSettings.themeMode).toBe('light')
    expect(useSettingsStore.getState().settings.themeMode).toBe('light')
    expect(useSettingsStore.getState().hasUnsavedChanges).toBe(true)
  })

  it('preserves pending edits when immediate shell persistence fails', async () => {
    const persisted = { ...cloneDefaultSettings(), defaultShell: zsh }
    useSettingsStore.setState({
      savedSettings: persisted,
      pendingSettings: persisted,
      settings: persisted,
    })

    let rejectPersistence!: (error: Error) => void
    settingsSet.mockReturnValueOnce(new Promise<AppSettings>((_resolve, reject) => {
      rejectPersistence = reject
    }))

    const persistence = useSettingsStore.getState().setDefaultShell(null)
    useSettingsStore.getState().setThemeMode('light')
    rejectPersistence(new Error('disk full'))
    await persistence

    expect(useSettingsStore.getState().savedSettings).toEqual(persisted)
    expect(useSettingsStore.getState().pendingSettings.themeMode).toBe('light')
    expect(useSettingsStore.getState().settings.themeMode).toBe('light')
    expect(useSettingsStore.getState().hasUnsavedChanges).toBe(true)
  })

  it('marks settings as unsaved when scrollbackLines is changed', () => {
    useSettingsStore.getState().setScrollbackLines(50_000)

    expect(useSettingsStore.getState().pendingSettings.scrollbackLines).toBe(50_000)
    expect(useSettingsStore.getState().settings.scrollbackLines).toBe(50_000)
    expect(useSettingsStore.getState().hasUnsavedChanges).toBe(true)
  })

  it('adopts the sanitized main response for every settings snapshot', async () => {
    const canonical = { ...cloneDefaultSettings(), colorTheme: 'tokyo-night' as const }
    settingsSet.mockResolvedValueOnce(canonical)
    useSettingsStore.getState().setColorTheme('dracula')

    await useSettingsStore.getState().saveSettings()

    expect(useSettingsStore.getState().savedSettings).toEqual(canonical)
    expect(useSettingsStore.getState().pendingSettings).toEqual(canonical)
    expect(useSettingsStore.getState().settings).toEqual(canonical)
    expect(useSettingsStore.getState().hasUnsavedChanges).toBe(false)
  })

  it('rolls every settings snapshot back when persistence fails', async () => {
    const saved = cloneDefaultSettings()
    settingsSet.mockRejectedValueOnce(new Error('disk full'))
    useSettingsStore.getState().setColorTheme('dracula')

    await expect(useSettingsStore.getState().saveSettings()).rejects.toThrow('disk full')

    expect(useSettingsStore.getState().savedSettings).toEqual(saved)
    expect(useSettingsStore.getState().pendingSettings).toEqual(saved)
    expect(useSettingsStore.getState().settings).toEqual(saved)
    expect(useSettingsStore.getState().hasUnsavedChanges).toBe(false)
  })

  it('restores the live app-font preview when changes are cancelled', () => {
    useSettingsStore.getState().setModernFontFamily('inter')
    expect(document.body.style.fontFamily).toContain('Inter')

    useSettingsStore.getState().cancelSettings()

    expect(document.body.style.fontFamily).not.toContain('Inter')
  })

  it('imports legacy renderer settings only over an untouched main profile', () => {
    expect(shouldImportLegacySettings(cloneDefaultSettings())).toBe(true)
    expect(shouldImportLegacySettings({
      ...cloneDefaultSettings(),
      colorTheme: 'dracula',
    })).toBe(false)
    expect(shouldImportLegacySettings({
      ...cloneDefaultSettings(),
      defaultShell: zsh,
    })).toBe(false)
  })
})
