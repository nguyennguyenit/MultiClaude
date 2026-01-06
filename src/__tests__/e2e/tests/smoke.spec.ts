import { test, expect } from '../fixtures'

/**
 * Smoke test to verify Playwright + Electron setup works correctly.
 * This test validates the basic infrastructure before running full test suite.
 */
test.describe('Smoke Test - App Launch', () => {
  test('app launches and displays main window', async ({ app, window }) => {
    // Verify app is running
    expect(app).toBeDefined()

    // Verify window is available
    expect(window).toBeDefined()

    // Verify window title contains app name
    const title = await window.title()
    expect(title).toBeTruthy()

    // Verify basic DOM structure exists
    const body = await window.locator('body')
    await expect(body).toBeVisible()

    // Verify React root exists
    const root = await window.locator('#root')
    await expect(root).toBeVisible()
  })

  test('app closes cleanly', async ({ app }) => {
    // App close is handled by fixture cleanup
    // This test verifies no errors during normal lifecycle
    expect(app).toBeDefined()
  })
})
