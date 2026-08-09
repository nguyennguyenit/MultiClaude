import { afterEach, describe, expect, it } from 'vitest'
import { DEFAULT_SETTINGS, SCROLLBACK_DEFAULT, SCROLLBACK_MAX, SCROLLBACK_MIN } from '@shared/constants'
import { SettingsStore } from '../settings-store'
import { SETTINGS_MIGRATION_FIXTURES } from './settings-migration-fixtures'

describe('SettingsStore', () => {
  afterEach(() => {
    delete process.env['MULTICLAUDE_TEST_STORE_PATH']
  })
  it('persists terminalFontFamily selections', () => {
    const store = new SettingsStore()

    const updated = store.setSettings({ terminalFontFamily: 'system' })

    expect(updated.terminalFontFamily).toBe('system')
    expect(store.getSettings().terminalFontFamily).toBe('system')
  })

  it('creates a canonical schema-v2 renderer profile by default', () => {
    const settings = new SettingsStore().getSettings()

    expect(settings.settingsSchemaVersion).toBe(2)
    expect(settings.terminalRendererPolicy).toBe('automatic')
    expect(settings).not.toHaveProperty('terminalRenderMode')
    expect(settings).not.toHaveProperty('gpuRendererForClaudeTerminals')
    expect(DEFAULT_SETTINGS.settingsSchemaVersion).toBe(2)
  })

  it.each(['automatic', 'prefer-gpu', 'safe-dom'] as const)(
    'round-trips canonical renderer policy %s',
    (terminalRendererPolicy) => {
      const store = new SettingsStore()

      expect(store.setSettings({ terminalRendererPolicy }).terminalRendererPolicy)
        .toBe(terminalRendererPolicy)
      expect(store.getSettings().terminalRendererPolicy).toBe(terminalRendererPolicy)
    },
  )

  it('preserves the current renderer policy across an unrelated partial update', () => {
    const store = new SettingsStore()
    store.setSettings({ terminalRendererPolicy: 'prefer-gpu' })

    const updated = store.setSettings({ colorTheme: 'dracula' })

    expect(updated.terminalRendererPolicy).toBe('prefer-gpu')
  })

  it('uses the current renderer policy when a partial update contains an invalid value', () => {
    const store = new SettingsStore()
    store.setSettings({ terminalRendererPolicy: 'safe-dom' })

    const updated = store.setSettings({ terminalRendererPolicy: 'invalid' as never })

    expect(updated.terminalRendererPolicy).toBe('safe-dom')
  })

  it.each(['tokyo-night', 'catppuccin', 'dracula', 'rose-pine', 'pro-dark'] as const)(
    'round-trips current theme %s',
    (colorTheme) => {
      const store = new SettingsStore()
      expect(store.setSettings({ colorTheme }).colorTheme).toBe(colorTheme)
      expect(store.getSettings().colorTheme).toBe(colorTheme)
    },
  )

  it('rejects Ghostty while the native backend capability is unavailable', () => {
    const store = new SettingsStore()
    expect(store.setSettings({ terminalEngine: 'ghostty' }).terminalEngine).toBe('xterm')
  })

  it('round-trips a canonical WSL shell including its distro', () => {
    const store = new SettingsStore()
    const defaultShell = {
      path: 'wsl.exe',
      name: 'Ubuntu-24.04',
      distro: 'Ubuntu-24.04',
      isDefault: true,
      kind: 'wsl' as const,
    }

    expect(store.setSettings({ defaultShell }).defaultShell).toEqual(defaultShell)
  })

  it('clears a persisted default shell when the field is explicitly unset', () => {
    const store = new SettingsStore()
    const defaultShell = {
      path: '/bin/zsh',
      name: 'zsh',
      isDefault: true,
      kind: 'unix' as const,
    }
    store.setSettings({ defaultShell })

    const updated = store.setSettings({ defaultShell: undefined })

    expect(updated.defaultShell).toBeUndefined()
    expect(store.getSettings().defaultShell).toBeUndefined()
  })

  it('rejects invalid terminalFontFamily values', () => {
    const store = new SettingsStore()

    const updated = store.setSettings({ terminalFontFamily: 'invalid-font' as never })

    expect(updated.terminalFontFamily).toBe('jetbrains-mono')
  })

  it('migrates the legacy Claude GPU override without persisting retired keys', () => {
    const store = new SettingsStore()

    const updated = store.setSettings({ gpuRendererForClaudeTerminals: true } as never)

    expect(updated.terminalRendererPolicy).toBe('prefer-gpu')
    expect(updated).not.toHaveProperty('gpuRendererForClaudeTerminals')
    expect(store.getSettings()).not.toHaveProperty('gpuRendererForClaudeTerminals')
  })

  it('persists a valid scrollbackLines value within range', () => {
    const store = new SettingsStore()

    const updated = store.setSettings({ scrollbackLines: 50_000 })

    expect(updated.scrollbackLines).toBe(50_000)
    expect(store.getSettings().scrollbackLines).toBe(50_000)
  })

  it('clamps scrollbackLines below the minimum up to the floor', () => {
    const store = new SettingsStore()

    const updated = store.setSettings({ scrollbackLines: 10 })

    expect(updated.scrollbackLines).toBe(SCROLLBACK_MIN)
  })

  it('clamps scrollbackLines above the maximum down to the ceiling', () => {
    const store = new SettingsStore()

    const updated = store.setSettings({ scrollbackLines: 10_000_000 })

    expect(updated.scrollbackLines).toBe(SCROLLBACK_MAX)
  })

  it('falls back to the default when scrollbackLines is not a finite number', () => {
    const store = new SettingsStore()

    const updated = store.setSettings({ scrollbackLines: Number.NaN as never })

    expect(updated.scrollbackLines).toBe(SCROLLBACK_DEFAULT)
  })

  it.each([
    ['3.6.0', false],
    ['3.6.0-beta.1', true],
    ['3.6.0-rc.2', true],
    ['3.6.0-alpha.3', true],
  ] as const)('applies the channel-aware advanced default on a fresh %s install', (appVersion, expected) => {
    const store = new SettingsStore({ appVersion })
    expect(store.getSettings().enableContextWindowAdvanced).toBe(expected)
  })

  it('preserves an explicit false advanced setting on a prerelease channel', () => {
    const store = new SettingsStore({ appVersion: '3.6.0-beta.1' })
    store.setSettings({ enableContextWindowAdvanced: false })

    expect(store.getSettings().enableContextWindowAdvanced).toBe(false)
    expect(store.getSettings()).not.toHaveProperty('enableThinkingSyntaxHighlight')
  })

  it('resets a prerelease install to its channel-aware defaults', () => {
    const store = new SettingsStore({ appVersion: '3.6.0-beta.1' })
    store.setSettings({ enableContextWindowAdvanced: false })

    expect(store.resetSettings().enableContextWindowAdvanced).toBe(true)
    expect(store.getSettings().enableContextWindowAdvanced).toBe(true)
  })

  it('recovers a complete channel-aware profile after interrupted first-run preparation', () => {
    process.env['MULTICLAUDE_TEST_STORE_PATH'] = 'settings-first-run-recovery-beta'
    new SettingsStore({ appVersion: '3.6.0-beta.1' })

    const recovered = new SettingsStore({ appVersion: '3.6.0-beta.1' }).getSettings()

    expect(recovered.enableContextWindowAdvanced).toBe(true)
    expect(recovered.terminalEngine).toBe('xterm')
    expect(recovered.terminalRendererPolicy).toBe('automatic')
    expect(recovered.terminalLimit).toEqual({ preset: 9 })
  })

  it('persists enableContextWindowAdvanced and ignores retired thinking toggles', () => {
    const store = new SettingsStore()

    const updated = store.setSettings({
      enableContextWindowAdvanced: true,
      enableThinkingSyntaxHighlight: true,
    } as never)

    expect(updated.enableContextWindowAdvanced).toBe(true)
    expect(store.getSettings().enableContextWindowAdvanced).toBe(true)
    expect(updated).not.toHaveProperty('enableThinkingSyntaxHighlight')
  })

  it.each(SETTINGS_MIGRATION_FIXTURES)(
    'captures current reload behavior for $name',
    ({ payload, preserved }) => {
      const store = new SettingsStore()

      const updated = store.setSettings(payload as Partial<import('@shared/types').AppSettings>)

      expect(updated).toMatchObject(preserved)
      expect(store.getSettings()).toMatchObject(preserved)
      for (const legacyKey of SETTINGS_MIGRATION_FIXTURES.find(fixture => fixture.payload === payload)?.legacyKeys ?? []) {
        expect(updated).not.toHaveProperty(legacyKey)
        expect(store.getSettings()).not.toHaveProperty(legacyKey)
      }
    }
  )
})
