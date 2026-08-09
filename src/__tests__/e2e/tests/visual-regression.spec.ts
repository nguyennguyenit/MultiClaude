import {
  test,
  expect,
  injectMockProject,
  mockProject,
  WAIT_TIMES
} from '../fixtures'
import type { Page } from '@playwright/test'

/**
 * Visual regression tests for MultiClaude themes.
 * Captures screenshots for different theme/mode combinations.
 * NOTE: Skipped on CI due to environment-specific rendering differences.
 */

// Skip all visual regression tests on CI (window dimensions differ)
const isCI = process.env.CI === 'true'
test.skip(isCI, 'Visual regression tests skipped on CI due to environment differences')

// Representative themes for visual regression (subset to keep test count manageable)
const representativeThemes = ['tokyo-night', 'dracula', 'pro-dark'] as const
const themeModes = ['light', 'dark'] as const

/**
 * Persist a theme through the canonical main-owned settings API.
 */
async function setTheme(
  window: Page,
  theme: string,
  mode: string
): Promise<void> {
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
  // Wait for theme application and animations to settle
  await window.waitForTimeout(WAIT_TIMES.STANDARD)
}

test.describe('Visual Regression - Project Toolbar', () => {
  for (const mode of themeModes) {
    for (const theme of representativeThemes) {
      test(`project toolbar ${theme} ${mode}`, async ({ window }) => {
        // Set theme
        await setTheme(window, theme, mode)

        // Inject mock project to have content in the project toolbar
        await injectMockProject(window, [mockProject])

        // Wait for toolbar content to render
        await window.waitForTimeout(WAIT_TIMES.MEDIUM)

        const toolbar = window.locator('.toolbar')
        await expect(toolbar).toBeVisible()

        // Take screenshot with small tolerance for anti-aliasing
        await expect(toolbar).toHaveScreenshot(`project-toolbar-${theme}-${mode}.png`, {
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
  test('theme change updates the rendered page after canonical settings reload', async ({ window }) => {
    await setTheme(window, 'tokyo-night', 'dark')
    await injectMockProject(window, [mockProject])

    // Take baseline screenshot
    const baselineScreenshot = await window.screenshot()
    expect(baselineScreenshot).toBeTruthy()

    await setTheme(window, 'dracula', 'dark')

    await expect.poll(() => window.evaluate(() =>
      getComputedStyle(document.documentElement).getPropertyValue('--mc-accent').trim().toLowerCase()
    )).toBe('#bd93f9')
    const updatedScreenshot = await window.screenshot()
    expect(updatedScreenshot.equals(baselineScreenshot)).toBe(false)
  })
})

test.describe('Visual Regression - Empty State', () => {
  for (const mode of themeModes) {
    test(`empty state ${mode}`, async ({ window }) => {
      // Set theme with no projects
      await setTheme(window, 'tokyo-night', mode)
      await injectMockProject(window, [])
      await window.waitForTimeout(WAIT_TIMES.STANDARD)

      // Take screenshot of empty state
      await expect(window).toHaveScreenshot(`empty-state-${mode}.png`, {
        maxDiffPixelRatio: 0.01,
        animations: 'disabled'
      })
    })
  }
})
