import type { AppSettings } from '@shared/types'

export interface SettingsMigrationFixture {
  name: string
  payload: Record<string, unknown>
  preserved: Partial<AppSettings>
  legacyKeys: readonly string[]
}

export const SETTINGS_MIGRATION_FIXTURES: readonly SettingsMigrationFixture[] = [
  {
    name: 'supported appearance and terminal selections',
    payload: {
      themeMode: 'system',
      colorTheme: 'ocean',
      terminalFontFamily: 'fira-code',
      modernFontFamily: 'inter',
      scrollbackLines: 50_000,
    },
    preserved: {
      themeMode: 'system',
      colorTheme: 'tokyo-night',
      terminalFontFamily: 'fira-code',
      modernFontFamily: 'inter',
      scrollbackLines: 50_000,
    },
    legacyKeys: [],
  },
  {
    name: 'legacy presentation fields',
    payload: {
      uiStyle: 'terminal',
      terminalStyleOptions: {
        colorPreset: 'green',
        fontFamily: 'vt323',
        useBorderChars: true,
      },
      activityBarState: 'expanded',
    },
    preserved: {
      colorTheme: 'catppuccin',
      terminalFontFamily: 'vt323',
    },
    legacyKeys: ['uiStyle', 'terminalStyleOptions', 'activityBarState'],
  },
  {
    name: 'context feature toggles',
    payload: {
      enableContextWindow: true,
      enableContextWindowAdvanced: true,
      enableThinkingSyntaxHighlight: true,
      reflowSafeScrollback: true,
    },
    preserved: {
      enableContextWindow: true,
      enableContextWindowAdvanced: true,
    },
    legacyKeys: ['enableThinkingSyntaxHighlight', 'reflowSafeScrollback'],
  },
]
