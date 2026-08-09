import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { DEFAULT_SETTINGS } from '@shared/constants'
import type { AppSettings, ShellInfo } from '@shared/types'
import { shouldImportLegacySettings, useSettingsStore } from './settings-store'

function cloneDefaultSettings(): AppSettings {
  return structuredClone(DEFAULT_SETTINGS)
}

const settingsSet = vi.fn()
const settingsGet = vi.fn()
const zsh: ShellInfo = { path: '/bin/zsh', name: 'zsh', isDefault: true, kind: 'unix' }

function installLocalStorage(initial?: string) {
  let value = initial ?? null
  const storage = {
    getItem: vi.fn(() => value),
    removeItem: vi.fn(() => { value = null }),
    setItem: vi.fn((_key: string, next: string) => { value = next }),
  }
  vi.stubGlobal('localStorage', storage)
  return storage
}

async function loadFreshSettingsStore() {
  vi.resetModules()
  return import('./settings-store')
}

describe('useSettingsStore', () => {
  beforeEach(() => {
    settingsSet.mockReset().mockImplementation(async (partial: Partial<AppSettings>) => ({
      ...cloneDefaultSettings(),
      ...partial,
    }))
    settingsGet.mockReset().mockResolvedValue(cloneDefaultSettings())
    Object.defineProperty(globalThis, 'window', {
      value: {
        electron: {
          settings: {
            set: settingsSet,
            get: settingsGet,
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

  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  it('keeps the settings alias in sync with canonical renderer policy previews', () => {
    useSettingsStore.getState().setTerminalRendererPolicy('safe-dom')

    expect(useSettingsStore.getState().pendingSettings.terminalRendererPolicy).toBe('safe-dom')
    expect(useSettingsStore.getState().settings.terminalRendererPolicy).toBe('safe-dom')
    expect(useSettingsStore.getState().savedSettings.terminalRendererPolicy).toBe('automatic')
    expect(useSettingsStore.getState().hasUnsavedChanges).toBe(true)
  })

  it('clears dirty state when a renderer policy preview returns to the saved value', () => {
    useSettingsStore.getState().setTerminalRendererPolicy('prefer-gpu')
    useSettingsStore.getState().setTerminalRendererPolicy('automatic')

    expect(useSettingsStore.getState().hasUnsavedChanges).toBe(false)
  })

  it('synchronously restores pending settings and the compatibility alias on cancel', () => {
    const saved = cloneDefaultSettings()
    useSettingsStore.getState().setTerminalRendererPolicy('safe-dom')

    useSettingsStore.getState().cancelSettings()

    expect(useSettingsStore.getState().pendingSettings).toEqual(saved)
    expect(useSettingsStore.getState().settings).toEqual(saved)
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

  it('captures the submitted profile and lets the canonical response replace later previews', async () => {
    const submitted = { ...cloneDefaultSettings(), terminalRendererPolicy: 'prefer-gpu' as const }
    const canonical = { ...cloneDefaultSettings(), terminalRendererPolicy: 'safe-dom' as const }
    let resolveSave!: (settings: AppSettings) => void
    settingsSet.mockReturnValueOnce(new Promise<AppSettings>((resolve) => {
      resolveSave = resolve
    }))
    useSettingsStore.getState().setTerminalRendererPolicy('prefer-gpu')

    const saving = useSettingsStore.getState().saveSettings()
    useSettingsStore.getState().setColorTheme('dracula')
    resolveSave(canonical)
    await saving

    expect(settingsSet).toHaveBeenCalledWith(submitted)
    expect(useSettingsStore.getState().savedSettings).toEqual(canonical)
    expect(useSettingsStore.getState().pendingSettings).toEqual(canonical)
    expect(useSettingsStore.getState().settings).toEqual(canonical)
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

  it('never logs complete settings records or raw save errors', async () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => undefined)
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    useSettingsStore.getState().setTerminalRendererPolicy('prefer-gpu')
    settingsSet.mockRejectedValueOnce(new Error('/Users/private/settings.json'))

    await expect(useSettingsStore.getState().saveSettings()).rejects.toThrow()

    expect(log).not.toHaveBeenCalled()
    expect(error).toHaveBeenCalledWith('[settings] Failed to save settings.')
    expect(error).not.toHaveBeenCalledWith(expect.anything(), expect.anything())
  })

  it('restores the live app-font preview when changes are cancelled', () => {
    useSettingsStore.getState().setModernFontFamily('inter')
    expect(document.body.style.fontFamily).toContain('Inter')

    useSettingsStore.getState().cancelSettings()

    expect(document.body.style.fontFamily).not.toContain('Inter')
  })

  it('imports legacy renderer settings over channel-only default differences', () => {
    expect(shouldImportLegacySettings(cloneDefaultSettings())).toBe(true)
    expect(shouldImportLegacySettings({
      ...cloneDefaultSettings(),
      enableContextWindowAdvanced: true,
    })).toBe(true)
    expect(shouldImportLegacySettings({
      ...cloneDefaultSettings(),
      colorTheme: 'dracula',
    })).toBe(false)
    expect(shouldImportLegacySettings({
      ...cloneDefaultSettings(),
      defaultShell: zsh,
    })).toBe(false)
  })

  it('keeps all snapshots canonical on load success and defaulted on load failure', async () => {
    const canonical = { ...cloneDefaultSettings(), terminalRendererPolicy: 'safe-dom' as const }
    installLocalStorage()
    settingsGet.mockResolvedValueOnce(canonical)

    await useSettingsStore.getState().loadSettings()
    expect(useSettingsStore.getState().savedSettings).toEqual(canonical)
    expect(useSettingsStore.getState().pendingSettings).toEqual(canonical)
    expect(useSettingsStore.getState().settings).toEqual(canonical)

    settingsGet.mockRejectedValueOnce(new Error('/private/profile'))
    await useSettingsStore.getState().loadSettings()
    expect(useSettingsStore.getState().savedSettings).toEqual(DEFAULT_SETTINGS)
    expect(useSettingsStore.getState().pendingSettings).toEqual(DEFAULT_SETTINGS)
    expect(useSettingsStore.getState().settings).toEqual(DEFAULT_SETTINGS)
  })

  it('adopts a successful one-time legacy import and deletes its local source', async () => {
    const storage = installLocalStorage(JSON.stringify({ terminalRenderMode: 'quality' }))
    const canonical = { ...cloneDefaultSettings(), terminalRendererPolicy: 'prefer-gpu' as const }
    settingsSet.mockResolvedValueOnce(canonical)
    const { useSettingsStore: freshStore } = await loadFreshSettingsStore()

    await freshStore.getState().loadSettings()

    expect(freshStore.getState().savedSettings).toEqual(canonical)
    expect(freshStore.getState().pendingSettings).toEqual(canonical)
    expect(freshStore.getState().settings).toEqual(canonical)
    expect(storage.removeItem).toHaveBeenCalledWith('multiclaude-settings')
  })

  it('retains legacy local storage when canonical import fails', async () => {
    const storage = installLocalStorage(JSON.stringify({ terminalRenderMode: 'quality' }))
    settingsSet.mockRejectedValueOnce(new Error('/private/profile'))
    const warning = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    const { useSettingsStore: freshStore } = await loadFreshSettingsStore()

    await freshStore.getState().loadSettings()

    expect(storage.removeItem).not.toHaveBeenCalled()
    expect(warning).toHaveBeenCalledWith('[settings] Legacy settings import failed.')
  })

  it('deletes superseded legacy local storage when a customized main profile wins', async () => {
    const storage = installLocalStorage(JSON.stringify({ terminalRenderMode: 'quality' }))
    settingsGet.mockResolvedValueOnce({ ...cloneDefaultSettings(), colorTheme: 'dracula' })
    const { useSettingsStore: freshStore } = await loadFreshSettingsStore()

    await freshStore.getState().loadSettings()

    expect(settingsSet).not.toHaveBeenCalled()
    expect(storage.removeItem).toHaveBeenCalledWith('multiclaude-settings')
  })
})
