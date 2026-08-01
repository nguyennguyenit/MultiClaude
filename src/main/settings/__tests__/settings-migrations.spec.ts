import { describe, expect, it } from 'vitest'
import { CURRENT_SETTINGS_SCHEMA_VERSION, migrateSettings } from '../settings-migrations'
import { THEMES } from '@shared/constants'

describe('migrateSettings', () => {
  it.each([
    ['default', 'tokyo-night'],
    ['dusk', 'rose-pine'],
    ['lime', 'catppuccin'],
    ['ocean', 'tokyo-night'],
    ['retro', 'dracula'],
    ['neo', 'dracula'],
    ['forest', 'catppuccin'],
    ['neon-cyber', 'tokyo-night'],
    ['vibrant', 'rose-pine'],
  ])('maps legacy theme %s to %s', (legacy, current) => {
    expect(migrateSettings({ colorTheme: legacy }).colorTheme).toBe(current)
  })

  it.each(THEMES.map(theme => theme.id))(
    'preserves current theme %s',
    (theme) => {
      expect(migrateSettings({ colorTheme: theme }).colorTheme).toBe(theme)
    },
  )

  it('migrates a WSL shell to the canonical default shell without losing its distro', () => {
    const migrated = migrateSettings({
      windowsShell: { type: 'wsl', distro: 'Ubuntu-24.04' },
    })

    expect(migrated.defaultShell).toEqual({
      path: 'wsl.exe',
      name: 'Ubuntu-24.04',
      distro: 'Ubuntu-24.04',
      isDefault: true,
      kind: 'wsl',
    })
    expect(migrated).not.toHaveProperty('windowsShell')
  })

  it('preserves legacy terminal presentation through canonical theme and font fields', () => {
    const migrated = migrateSettings({
      uiStyle: 'terminal',
      terminalStyleOptions: {
        colorPreset: 'green',
        fontFamily: 'vt323',
        useBorderChars: true,
      },
    })

    expect(migrated.colorTheme).toBe('catppuccin')
    expect(migrated.terminalFontFamily).toBe('vt323')
  })

  it('drops retired fields and is idempotent', () => {
    const first = migrateSettings({
      enableThinkingSyntaxHighlight: true,
      glassmorphismEnabled: true,
      activityBarState: 'expanded',
      uiStyle: 'terminal',
      terminalStyleOptions: { colorPreset: 'blue', fontFamily: 'fira-code' },
      reflowSafeScrollback: true,
    })

    expect(first).not.toHaveProperty('enableThinkingSyntaxHighlight')
    expect(first).not.toHaveProperty('glassmorphismEnabled')
    expect(first).not.toHaveProperty('activityBarState')
    expect(first).not.toHaveProperty('uiStyle')
    expect(first).not.toHaveProperty('terminalStyleOptions')
    expect(first).not.toHaveProperty('reflowSafeScrollback')
    expect(first.settingsSchemaVersion).toBe(CURRENT_SETTINGS_SCHEMA_VERSION)
    expect(migrateSettings(first)).toEqual(first)
  })
})
