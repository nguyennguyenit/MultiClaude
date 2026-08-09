import { test, expect } from '../fixtures'
import type { Page } from '@playwright/test'

/**
 * Theme tests for MultiClaude application.
 * Tests color theme application and theme mode switching.
 */

const colorThemes = [
  ['tokyo-night', '#7aa2f7'],
  ['catppuccin', '#89b4fa'],
  ['dracula', '#bd93f9'],
  ['rose-pine', '#c4a7e7'],
  ['pro-dark', '#3b82f6']
] as const

/**
 * Write through the canonical main-owned settings API, then reload the
 * renderer so persistence and startup application are both exercised.
 */
async function setTheme(
  window: Page,
  theme: string,
  mode: string
): Promise<void> {
  const previous = await window.evaluate(async () => ({
    settings: await globalThis.window.electron.settings.get(),
    accent: getComputedStyle(document.documentElement).getPropertyValue('--mc-accent').trim()
  }))

  await window.evaluate(
    async ({ theme, mode }: { theme: string; mode: string }) => {
      await globalThis.window.electron.settings.set({
        colorTheme: theme,
        themeMode: mode
      } as Parameters<typeof globalThis.window.electron.settings.set>[0])
    },
    { theme, mode }
  )
  await window.reload()
  await window.waitForLoadState('domcontentloaded')
  await expect.poll(() => window.evaluate(async () => {
    const settings = await globalThis.window.electron.settings.get()
    return { colorTheme: settings.colorTheme, themeMode: settings.themeMode }
  })).toEqual({ colorTheme: theme, themeMode: mode })

  if (previous.settings.colorTheme !== theme) {
    await expect.poll(() => window.evaluate(() =>
      getComputedStyle(document.documentElement).getPropertyValue('--mc-accent').trim()
    )).not.toBe(previous.accent)
  }
}

test.describe('Color Theme Application', () => {
  for (const [theme, expectedAccent] of colorThemes) {
    test(`${theme} theme applies correctly`, async ({ window }) => {
      await setTheme(window, theme, 'dark')

      await expect.poll(() => window.evaluate(() =>
        getComputedStyle(document.documentElement).getPropertyValue('--mc-accent').trim().toLowerCase()
      )).toBe(expectedAccent)
    })
  }
})

test.describe('Theme Mode Application', () => {
  test('light mode applies correctly', async ({ window }) => {
    await setTheme(window, 'tokyo-night', 'light')

    const html = window.locator('html')
    await expect(html).toHaveAttribute('data-theme-mode', 'light')
  })

  test('dark mode applies correctly', async ({ window }) => {
    await setTheme(window, 'tokyo-night', 'dark')

    const html = window.locator('html')
    await expect(html).toHaveAttribute('data-theme-mode', 'dark')
  })

  test('system mode follows OS preference (dark)', async ({ window }) => {
    // Emulate dark color scheme preference
    await window.emulateMedia({ colorScheme: 'dark' })
    await setTheme(window, 'tokyo-night', 'system')

    const html = window.locator('html')
    await expect(html).toHaveAttribute('data-theme-mode', 'dark')
  })

  test('system mode follows OS preference (light)', async ({ window }) => {
    // Emulate light color scheme preference
    await window.emulateMedia({ colorScheme: 'light' })
    await setTheme(window, 'tokyo-night', 'system')

    const html = window.locator('html')
    await expect(html).toHaveAttribute('data-theme-mode', 'light')
  })

  test('system mode reacts to OS preference changes without reload', async ({ window }) => {
    await window.emulateMedia({ colorScheme: 'light' })
    await setTheme(window, 'tokyo-night', 'system')

    const html = window.locator('html')
    await expect(html).toHaveAttribute('data-theme-mode', 'light')
    await expect.poll(() => window.evaluate(() =>
      getComputedStyle(document.documentElement).getPropertyValue('--terminal-bg').trim().toLowerCase()
    )).toBe('#f8fafc')

    await window.emulateMedia({ colorScheme: 'dark' })

    await expect(html).toHaveAttribute('data-theme-mode', 'dark')
    await expect.poll(() => window.evaluate(() =>
      getComputedStyle(document.documentElement).getPropertyValue('--terminal-bg').trim().toLowerCase()
    )).toBe('#1a1b26')
  })
})

test.describe('Theme Persistence', () => {
  test('theme persists after reload', async ({ window }) => {
    // Set a non-default theme
    await setTheme(window, 'dracula', 'dark')

    // Reload page
    await window.reload()
    await window.waitForLoadState('domcontentloaded')
    await expect.poll(() => window.evaluate(async () =>
      (await globalThis.window.electron.settings.get()).colorTheme
    )).toBe('dracula')
    await expect.poll(() => window.evaluate(() =>
      getComputedStyle(document.documentElement).getPropertyValue('--mc-accent').trim().toLowerCase()
    )).toBe('#bd93f9')
  })

  test('mode persists after reload', async ({ window }) => {
    // Set light mode
    await setTheme(window, 'tokyo-night', 'light')

    // Reload page
    await window.reload()
    await window.waitForLoadState('domcontentloaded')
    const html = window.locator('html')
    await expect(html).toHaveAttribute('data-theme-mode', 'light')
    await expect.poll(() => window.evaluate(async () =>
      (await globalThis.window.electron.settings.get()).themeMode
    )).toBe('light')
  })
})

test.describe('Theme CSS Variables', () => {
  const cssVarsToCheck = [
    '--mc-bg-primary',
    '--mc-bg-secondary',
    '--mc-bg-tertiary',
    '--mc-text-primary',
    '--mc-text-secondary',
    '--mc-accent',
    '--mc-border'
  ]

  test('all essential CSS variables are defined', async ({ window }) => {
    await setTheme(window, 'tokyo-night', 'dark')

    for (const varName of cssVarsToCheck) {
      const value = await window.evaluate((name) => {
        return getComputedStyle(document.documentElement).getPropertyValue(name)
      }, varName)
      expect(value.trim(), `CSS variable ${varName} should be defined`).toBeTruthy()
    }
  })

  test('CSS variables change with theme', async ({ window }) => {
    await setTheme(window, 'tokyo-night', 'dark')
    const tokyoAccent = await window.evaluate(() => {
      return getComputedStyle(document.documentElement).getPropertyValue('--mc-accent')
    })

    await setTheme(window, 'dracula', 'dark')
    const draculaAccent = await window.evaluate(() => {
      return getComputedStyle(document.documentElement).getPropertyValue('--mc-accent')
    })

    expect(tokyoAccent.trim()).not.toBe(draculaAccent.trim())
  })

  test('CSS variables change with mode', async ({ window }) => {
    // Get background for dark mode
    await setTheme(window, 'tokyo-night', 'dark')
    const darkBg = await window.evaluate(() => {
      return getComputedStyle(document.documentElement).getPropertyValue('--mc-bg-primary')
    })

    // Get background for light mode
    await setTheme(window, 'tokyo-night', 'light')
    const lightBg = await window.evaluate(() => {
      return getComputedStyle(document.documentElement).getPropertyValue('--mc-bg-primary')
    })

    // Backgrounds should be different between modes
    expect(darkBg.trim()).not.toBe(lightBg.trim())
  })
})
