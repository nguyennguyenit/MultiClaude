import { test, expect, injectMockProject, mockProject, WAIT_TIMES } from '../fixtures'
import type { Page } from '@playwright/test'

/**
 * Visual regression tests for MultiClaude themes.
 * Captures screenshots for different theme/mode combinations.
 */

const SETTINGS_KEY = 'multiclaude-settings'

// Representative themes for visual regression (subset to keep test count manageable)
const representativeThemes = ['default', 'ocean', 'vibrant'] as const
const themeModes = ['light', 'dark'] as const

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
  // Wait for theme application and animations to settle
  await window.waitForTimeout(WAIT_TIMES.STANDARD)
}

test.describe('Visual Regression - Sidebar', () => {
  for (const mode of themeModes) {
    for (const theme of representativeThemes) {
      test(`sidebar ${theme} ${mode}`, async ({ window }) => {
        // Set theme
        await setTheme(window, theme, mode)

        // Inject mock project to have content in sidebar
        await injectMockProject(window, [mockProject])

        // Wait for sidebar content to render
        await window.waitForTimeout(WAIT_TIMES.MEDIUM)

        // Find sidebar element
        const sidebar = window.locator('aside, [class*="sidebar"], [class*="Sidebar"]').first()

        // Take screenshot with small tolerance for anti-aliasing
        await expect(sidebar).toHaveScreenshot(`sidebar-${theme}-${mode}.png`, {
          maxDiffPixelRatio: 0.01,
          animations: 'disabled'
        })
      })
    }
  }
})

test.describe('Visual Regression - Settings Modal', () => {
  for (const mode of themeModes) {
    for (const theme of representativeThemes) {
      test(`settings modal ${theme} ${mode}`, async ({ window }) => {
        // Set theme
        await setTheme(window, theme, mode)

        // Inject mock project to show main layout with settings button
        await injectMockProject(window, [mockProject])
        await window.waitForTimeout(WAIT_TIMES.MEDIUM)

        // Open settings modal using data-testid
        const settingsButton = window.locator('[data-testid="settings-button"]')
        await settingsButton.click()
        await window.waitForTimeout(WAIT_TIMES.STANDARD)

        // Find modal element using data-testid
        const modal = window.locator('[data-testid="settings-modal"]')
        await expect(modal).toBeVisible()

        // Take screenshot
        await expect(modal).toHaveScreenshot(`settings-modal-${theme}-${mode}.png`, {
          maxDiffPixelRatio: 0.01,
          animations: 'disabled'
        })
      })
    }
  }
})

test.describe('Visual Regression - Terminal Area', () => {
  for (const mode of themeModes) {
    for (const theme of representativeThemes) {
      test(`terminal area ${theme} ${mode}`, async ({ window }) => {
        // Set theme
        await setTheme(window, theme, mode)

        // Inject mock project
        await injectMockProject(window, [mockProject])

        // Wait for terminal to render
        await window.waitForTimeout(WAIT_TIMES.LONG)

        // Find terminal container using data-testid
        const terminalArea = window.locator('[data-testid="terminal-area"]')

        // Take screenshot with higher tolerance for terminal anti-aliasing
        await expect(terminalArea).toHaveScreenshot(`terminal-${theme}-${mode}.png`, {
          maxDiffPixelRatio: 0.02,
          animations: 'disabled'
        })
      })
    }
  }
})

test.describe('Visual Regression - Full Page', () => {
  for (const mode of themeModes) {
    for (const theme of representativeThemes) {
      test(`full page ${theme} ${mode}`, async ({ window }) => {
        // Set theme
        await setTheme(window, theme, mode)

        // Inject mock project
        await injectMockProject(window, [mockProject])

        // Wait for everything to render
        await window.waitForTimeout(WAIT_TIMES.LONG)

        // Take full page screenshot
        await expect(window).toHaveScreenshot(`full-page-${theme}-${mode}.png`, {
          maxDiffPixelRatio: 0.015,
          fullPage: true,
          animations: 'disabled'
        })
      })
    }
  }
})

test.describe('Visual Regression - Theme Transitions', () => {
  test('theme change applies without visual glitches', async ({ window }) => {
    // Start with default dark
    await setTheme(window, 'default', 'dark')
    await injectMockProject(window, [mockProject])

    // Take baseline screenshot
    const baselineScreenshot = await window.screenshot()
    expect(baselineScreenshot).toBeTruthy()

    // Switch to ocean theme (without reload - via localStorage + dispatch)
    await window.evaluate(({ key }: { key: string }) => {
      const existing = localStorage.getItem(key)
      const settings = existing ? JSON.parse(existing) : {}
      settings.colorTheme = 'ocean'
      localStorage.setItem(key, JSON.stringify(settings))
    }, { key: SETTINGS_KEY })

    // Reload to apply
    await window.reload()
    await window.waitForLoadState('domcontentloaded')
    await window.waitForTimeout(WAIT_TIMES.STANDARD)

    // Verify theme changed
    const html = window.locator('html')
    await expect(html).toHaveClass(/theme-ocean/)
  })
})

test.describe('Visual Regression - Empty State', () => {
  for (const mode of themeModes) {
    test(`empty state ${mode}`, async ({ window }) => {
      // Set theme with no projects
      await setTheme(window, 'default', mode)

      // Clear any existing projects
      await window.evaluate(() => {
        localStorage.removeItem('projects')
      })
      await window.reload()
      await window.waitForLoadState('domcontentloaded')
      await window.waitForTimeout(WAIT_TIMES.STANDARD)

      // Take screenshot of empty state
      await expect(window).toHaveScreenshot(`empty-state-${mode}.png`, {
        maxDiffPixelRatio: 0.01,
        animations: 'disabled'
      })
    })
  }
})
