import { describe, expect, it } from 'vitest'
import { CURRENT_SETTINGS_SCHEMA_VERSION, migrateSettings } from '../settings-migrations'
import { THEMES } from '@shared/constants'

describe('migrateSettings', () => {
  it.each([
    ['performance', undefined, 'safe-dom'],
    ['performance', false, 'safe-dom'],
    ['performance', true, 'safe-dom'],
    ['balanced', undefined, 'automatic'],
    ['balanced', false, 'automatic'],
    ['balanced', true, 'prefer-gpu'],
    ['quality', undefined, 'prefer-gpu'],
    ['quality', false, 'prefer-gpu'],
    ['quality', true, 'prefer-gpu'],
  ])(
    'maps legacy renderer mode %s with GPU override %s to %s',
    (terminalRenderMode, gpuRendererForClaudeTerminals, expected) => {
      const migrated = migrateSettings({
        terminalRenderMode,
        ...(gpuRendererForClaudeTerminals === undefined
          ? {}
          : { gpuRendererForClaudeTerminals }),
      })

      expect(migrated.terminalRendererPolicy).toBe(expected)
      expect(migrated).not.toHaveProperty('terminalRenderMode')
      expect(migrated).not.toHaveProperty('gpuRendererForClaudeTerminals')
    },
  )

  it.each([undefined, null, 'unknown', { mode: 'quality' }])(
    'does not synthesize a policy for malformed legacy mode %j in a partial record',
    (terminalRenderMode) => {
      const migrated = migrateSettings(
        terminalRenderMode === undefined ? {} : { terminalRenderMode },
      )

      expect(migrated).not.toHaveProperty('terminalRendererPolicy')
      expect(migrated).not.toHaveProperty('terminalRenderMode')
    },
  )

  it('uses a literal true legacy GPU override without a valid legacy mode', () => {
    expect(migrateSettings({ gpuRendererForClaudeTerminals: true })).toMatchObject({
      settingsSchemaVersion: CURRENT_SETTINGS_SCHEMA_VERSION,
      terminalRendererPolicy: 'prefer-gpu',
    })
  })

  it('preserves a valid canonical policy over contradictory legacy keys', () => {
    const migrated = migrateSettings({
      terminalRendererPolicy: 'automatic',
      terminalRenderMode: 'performance',
      gpuRendererForClaudeTerminals: true,
    })

    expect(migrated.terminalRendererPolicy).toBe('automatic')
    expect(migrated).not.toHaveProperty('terminalRenderMode')
    expect(migrated).not.toHaveProperty('gpuRendererForClaudeTerminals')
  })

  it('never derives a schema-v2 policy from stale legacy keys', () => {
    const migrated = migrateSettings({
      settingsSchemaVersion: 2,
      terminalRenderMode: 'quality',
      gpuRendererForClaudeTerminals: true,
    })

    expect(migrated).not.toHaveProperty('terminalRendererPolicy')
    expect(migrated).not.toHaveProperty('terminalRenderMode')
    expect(migrated).not.toHaveProperty('gpuRendererForClaudeTerminals')
  })

  it('does not mutate its input and is deep-equal on a second pass', () => {
    const raw = {
      settingsSchemaVersion: 1,
      terminalRenderMode: 'balanced',
      gpuRendererForClaudeTerminals: true,
      nested: { preserved: true },
    }
    const original = structuredClone(raw)
    const first = migrateSettings(raw)

    expect(raw).toEqual(original)
    expect(migrateSettings(first)).toEqual(first)
  })

  it('ignores inherited renderer fields and uses only own properties', () => {
    const inherited = {
      settingsSchemaVersion: 2,
      terminalRendererPolicy: 'prefer-gpu',
      terminalRenderMode: 'quality',
      gpuRendererForClaudeTerminals: true,
    }
    const raw = Object.assign(Object.create(inherited) as Record<string, unknown>, {
      terminalRenderMode: 'balanced',
    })

    const migrated = migrateSettings(raw)

    expect(migrated.terminalRendererPolicy).toBe('automatic')
    expect(migrated).not.toHaveProperty('terminalRenderMode')
    expect(migrated).not.toHaveProperty('gpuRendererForClaudeTerminals')
  })

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
      terminalRenderMode: 'balanced',
      gpuRendererForClaudeTerminals: false,
    })

    expect(first).not.toHaveProperty('enableThinkingSyntaxHighlight')
    expect(first).not.toHaveProperty('glassmorphismEnabled')
    expect(first).not.toHaveProperty('activityBarState')
    expect(first).not.toHaveProperty('uiStyle')
    expect(first).not.toHaveProperty('terminalStyleOptions')
    expect(first).not.toHaveProperty('reflowSafeScrollback')
    expect(first).not.toHaveProperty('terminalRenderMode')
    expect(first).not.toHaveProperty('gpuRendererForClaudeTerminals')
    expect(first.settingsSchemaVersion).toBe(CURRENT_SETTINGS_SCHEMA_VERSION)
    expect(migrateSettings(first)).toEqual(first)
  })
})
