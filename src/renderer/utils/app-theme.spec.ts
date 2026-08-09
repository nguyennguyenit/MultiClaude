import { describe, expect, it } from 'vitest'
import { getTerminalTheme, THEMES } from '@shared/constants'
import type { ColorTheme } from '@shared/types'
import { resolveAppTheme } from './app-theme'

function contrastRatio(first: string, second: string): number {
  const luminance = (color: string) => {
    const channels = [1, 3, 5].map(index =>
      Number.parseInt(color.slice(index, index + 2), 16) / 255
    )
    const linear = channels.map(channel =>
      channel <= 0.04045
        ? channel / 12.92
        : ((channel + 0.055) / 1.055) ** 2.4
    )
    return linear[0] * 0.2126 + linear[1] * 0.7152 + linear[2] * 0.0722
  }
  const firstLuminance = luminance(first)
  const secondLuminance = luminance(second)
  return (
    (Math.max(firstLuminance, secondLuminance) + 0.05) /
    (Math.min(firstLuminance, secondLuminance) + 0.05)
  )
}

describe('resolveAppTheme', () => {
  const tokyoNight = THEMES.find(theme => theme.id === 'tokyo-night')!

  it('preserves the selected palette in dark mode', () => {
    expect(resolveAppTheme(tokyoNight, 'dark', false)).toMatchObject({
      mode: 'dark',
      background: tokyoNight.background,
      foreground: tokyoNight.foreground,
      accent: tokyoNight.accent,
    })
  })

  it('uses an application light palette while preserving theme identity', () => {
    const result = resolveAppTheme(tokyoNight, 'light', true)

    expect(result).toMatchObject({
      mode: 'light',
      background: '#f8fafc',
      foreground: '#0f172a',
      accent: '#315fba',
    })
    expect(result.background).not.toBe(tokyoNight.background)
  })

  it('follows the operating-system preference in system mode', () => {
    expect(resolveAppTheme(tokyoNight, 'system', false).mode).toBe('light')
    expect(resolveAppTheme(tokyoNight, 'system', true).mode).toBe('dark')
  })

  it.each(THEMES)('provides a light terminal palette for $id', (theme) => {
    const terminalTheme = getTerminalTheme(theme.id as ColorTheme, false)

    expect(terminalTheme.background).toBe('#f8fafc')
    expect(terminalTheme.foreground).toBe('#0f172a')
  })

  it.each(THEMES.flatMap(theme => [
    { theme, mode: 'light' as const },
    { theme, mode: 'dark' as const },
  ]))('keeps semantic text contrast accessible for $theme.id $mode', ({ theme, mode }) => {
    const palette = resolveAppTheme(theme, mode, false)

    expect(contrastRatio(palette.textSecondary, palette.background)).toBeGreaterThanOrEqual(4.5)
    expect(contrastRatio(palette.textMuted, palette.background)).toBeGreaterThanOrEqual(4.5)
    expect(contrastRatio(palette.onAccent, palette.accent)).toBeGreaterThanOrEqual(4.5)
  })
})
