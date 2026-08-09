import type { VibeTheme } from '@shared/constants'
import type { ThemeMode } from '@shared/types'

export type ResolvedThemeMode = 'light' | 'dark'

export interface AppThemePalette {
  mode: ResolvedThemeMode
  background: string
  foreground: string
  textSecondary: string
  textMuted: string
  accent: string
  onAccent: string
  border: string
  tabBg: string
  tabActiveBg: string
  hover: string
  cursor: string
  selectionBg: string
}

const LIGHT_ACCENTS: Readonly<Record<string, string>> = {
  'tokyo-night': '#315fba',
  catppuccin: '#365ea8',
  dracula: '#7650a8',
  'rose-pine': '#76568f',
  'pro-dark': '#2563eb',
}

function blendHex(foreground: string, background: string, opacity: number): string {
  const parse = (color: string) => [
    Number.parseInt(color.slice(1, 3), 16),
    Number.parseInt(color.slice(3, 5), 16),
    Number.parseInt(color.slice(5, 7), 16),
  ]
  const foregroundRgb = parse(foreground)
  const backgroundRgb = parse(background)
  const blended = foregroundRgb.map((channel, index) =>
    Math.round(channel * opacity + backgroundRgb[index] * (1 - opacity))
  )
  return `#${blended.map(channel => channel.toString(16).padStart(2, '0')).join('')}`
}

export function resolveThemeMode(
  mode: ThemeMode | undefined,
  prefersDark: boolean,
): ResolvedThemeMode {
  if (mode === 'light') return 'light'
  if (mode === 'dark') return 'dark'
  return prefersDark ? 'dark' : 'light'
}

export function resolveAppTheme(
  theme: VibeTheme,
  mode: ThemeMode | undefined,
  prefersDark: boolean,
): AppThemePalette {
  const resolvedMode = resolveThemeMode(mode, prefersDark)
  if (resolvedMode === 'dark') {
    return {
      mode: resolvedMode,
      background: theme.background,
      foreground: theme.foreground,
      textSecondary: blendHex(theme.foreground, theme.background, 0.75),
      textMuted: blendHex(theme.foreground, theme.background, 0.6),
      accent: theme.accent,
      onAccent: '#0f172a',
      border: theme.border,
      tabBg: theme.tabBg,
      tabActiveBg: theme.tabActiveBg,
      hover: theme.hover,
      cursor: theme.cursor,
      selectionBg: theme.selectionBg,
    }
  }

  const accent = LIGHT_ACCENTS[theme.id] ?? '#315fba'
  return {
    mode: resolvedMode,
    background: '#f8fafc',
    foreground: '#0f172a',
    textSecondary: '#49505f',
    textMuted: '#6c727e',
    accent,
    onAccent: '#ffffff',
    border: '#d8dee9',
    tabBg: '#eef2f7',
    tabActiveBg: '#ffffff',
    hover: '#e2e8f0',
    cursor: accent,
    selectionBg: `${accent}33`,
  }
}
