import { test, expect } from '../fixtures'
import type { Page } from '@playwright/test'

/**
 * Theme tests for MultiClaude application.
 * Tests color theme application and theme mode switching.
 */

// Actual color themes from the codebase
const colorThemes = [
  'default',
  'dusk',
  'lime',
  'ocean',
  'retro',
  'neo',
  'forest',
  'neon-cyber',
  'pro-dark',
  'vibrant'
] as const

const SETTINGS_KEY = 'multiclaude-settings'

/**
 * Helper to set theme via localStorage and reload.
 */
async function setTheme(
  window: Page,
  theme: string,
  mode: string
): Promise<void> {
  await window.evaluate(
    ({ theme, mode, key }: { theme: string; mode: string; key: string }) => {
      const existing = localStorage.getItem(key)
      const settings = existing ? JSON.parse(existing) : {}
      settings.colorTheme = theme
      settings.themeMode = mode
      localStorage.setItem(key, JSON.stringify(settings))
    },
    { theme, mode, key: SETTINGS_KEY }
  )
  await window.reload()
  await window.waitForLoadState('domcontentloaded')
  // Wait for React to apply theme classes
  await window.waitForTimeout(100)
}

test.describe('Color Theme Application', () => {
  for (const theme of colorThemes) {
    test(`${theme} theme applies correctly`, async ({ window }) => {
      // Set the theme via localStorage
      await setTheme(window, theme, 'dark')

      // Verify html element has the theme class
      const html = window.locator('html')
      await expect(html).toHaveClass(new RegExp(`theme-${theme}`))

      // Verify CSS variable --mc-accent exists and has a value
      const accentColor = await window.evaluate(() => {
        return getComputedStyle(document.documentElement).getPropertyValue('--mc-accent')
      })
      expect(accentColor.trim()).toBeTruthy()
    })
  }
})

test.describe('Theme Mode Application', () => {
  test('light mode applies correctly', async ({ window }) => {
    await setTheme(window, 'default', 'light')

    const html = window.locator('html')
    await expect(html).toHaveClass(/\blight\b/)
    await expect(html).not.toHaveClass(/\bdark\b/)
  })

  test('dark mode applies correctly', async ({ window }) => {
    await setTheme(window, 'default', 'dark')

    const html = window.locator('html')
    await expect(html).toHaveClass(/\bdark\b/)
    await expect(html).not.toHaveClass(/\blight\b/)
  })

  test('system mode follows OS preference (dark)', async ({ window }) => {
    // Emulate dark color scheme preference
    await window.emulateMedia({ colorScheme: 'dark' })
    await setTheme(window, 'default', 'system')

    const html = window.locator('html')
    await expect(html).toHaveClass(/\bdark\b/)
  })

  test('system mode follows OS preference (light)', async ({ window }) => {
    // Emulate light color scheme preference
    await window.emulateMedia({ colorScheme: 'light' })
    await setTheme(window, 'default', 'system')

    const html = window.locator('html')
    await expect(html).toHaveClass(/\blight\b/)
  })
})

test.describe('Theme Persistence', () => {
  test('theme persists after reload', async ({ window }) => {
    // Set a non-default theme
    await setTheme(window, 'ocean', 'dark')

    // Reload page
    await window.reload()
    await window.waitForLoadState('domcontentloaded')
    await window.waitForTimeout(100)

    // Verify theme is still applied
    const html = window.locator('html')
    await expect(html).toHaveClass(/theme-ocean/)
    await expect(html).toHaveClass(/\bdark\b/)
  })

  test('mode persists after reload', async ({ window }) => {
    // Set light mode
    await setTheme(window, 'default', 'light')

    // Reload page
    await window.reload()
    await window.waitForLoadState('domcontentloaded')
    await window.waitForTimeout(100)

    // Verify mode is still applied
    const html = window.locator('html')
    await expect(html).toHaveClass(/\blight\b/)
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
    await setTheme(window, 'default', 'dark')

    for (const varName of cssVarsToCheck) {
      const value = await window.evaluate((name) => {
        return getComputedStyle(document.documentElement).getPropertyValue(name)
      }, varName)
      expect(value.trim(), `CSS variable ${varName} should be defined`).toBeTruthy()
    }
  })

  test('CSS variables change with theme', async ({ window }) => {
    // Get accent color for default theme
    await setTheme(window, 'default', 'dark')
    const defaultAccent = await window.evaluate(() => {
      return getComputedStyle(document.documentElement).getPropertyValue('--mc-accent')
    })

    // Get accent color for ocean theme
    await setTheme(window, 'ocean', 'dark')
    const oceanAccent = await window.evaluate(() => {
      return getComputedStyle(document.documentElement).getPropertyValue('--mc-accent')
    })

    // Accents should be different between themes
    expect(defaultAccent.trim()).not.toBe(oceanAccent.trim())
  })

  test('CSS variables change with mode', async ({ window }) => {
    // Get background for dark mode
    await setTheme(window, 'default', 'dark')
    const darkBg = await window.evaluate(() => {
      return getComputedStyle(document.documentElement).getPropertyValue('--mc-bg-primary')
    })

    // Get background for light mode
    await setTheme(window, 'default', 'light')
    const lightBg = await window.evaluate(() => {
      return getComputedStyle(document.documentElement).getPropertyValue('--mc-bg-primary')
    })

    // Backgrounds should be different between modes
    expect(darkBg.trim()).not.toBe(lightBg.trim())
  })
})
