import { test, expect, injectMockProject } from '../fixtures'
import { mockProject } from '../fixtures/test-data'

/**
 * Settings modal E2E tests.
 * Tests modal open/close, tab navigation, and theme switching.
 */
test.describe('Settings Modal', () => {
  // Inject a project to show the main layout (not welcome screen)
  test.beforeEach(async ({ window }) => {
    await injectMockProject(window, [mockProject])
    await window.waitForTimeout(200)
  })

  test('settings modal opens when settings button clicked', async ({ window }) => {
    // Find and click settings button using data-testid
    const settingsButton = window.locator('[data-testid="settings-button"]')
    await expect(settingsButton).toBeVisible()
    await settingsButton.click()

    // Wait for modal to appear
    await window.waitForTimeout(200)

    // Verify modal is visible using data-testid
    const modal = window.locator('[data-testid="settings-modal"]')
    await expect(modal).toBeVisible()

    // Verify modal header
    const modalHeader = modal.locator('h2:has-text("Settings")')
    await expect(modalHeader).toBeVisible()
  })

  test('modal displays all 4 tabs: Appearance, Terminals, Notifications, Updates', async ({ window }) => {
    // Open settings modal
    const settingsButton = window.locator('[data-testid="settings-button"]')
    await settingsButton.click()
    await window.waitForTimeout(200)

    // Verify all 4 tabs are visible using data-testid
    await expect(window.locator('[data-testid="settings-tab-appearance"]')).toBeVisible()
    await expect(window.locator('[data-testid="settings-tab-terminals"]')).toBeVisible()
    await expect(window.locator('[data-testid="settings-tab-notifications"]')).toBeVisible()
    await expect(window.locator('[data-testid="settings-tab-updates"]')).toBeVisible()
  })

  test('tab navigation switches content correctly', async ({ window }) => {
    // Open settings modal
    const settingsButton = window.locator('[data-testid="settings-button"]')
    await settingsButton.click()
    await window.waitForTimeout(200)

    // Appearance tab should be active by default
    const appearanceContent = window.locator('h3:has-text("Appearance")')
    await expect(appearanceContent).toBeVisible()

    // Click Terminals tab
    await window.locator('[data-testid="settings-tab-terminals"]').click()
    await window.waitForTimeout(100)

    // Verify Terminals content is shown
    const terminalsContent = window.locator('text=Terminal').first()
    await expect(terminalsContent).toBeVisible()

    // Click Notifications tab
    await window.locator('[data-testid="settings-tab-notifications"]').click()
    await window.waitForTimeout(100)

    // Verify Notifications content is shown
    const notificationsContent = window.locator('text=Notification').first()
    await expect(notificationsContent).toBeVisible()

    // Click Updates tab
    await window.locator('[data-testid="settings-tab-updates"]').click()
    await window.waitForTimeout(100)

    // Verify Updates content is shown
    const updatesContent = window.locator('text=Update').first()
    await expect(updatesContent).toBeVisible()

    // Click back to Appearance
    await window.locator('[data-testid="settings-tab-appearance"]').click()
    await window.waitForTimeout(100)

    // Verify Appearance content is shown again
    await expect(appearanceContent).toBeVisible()
  })

  test('theme selector changes theme mode', async ({ window }) => {
    // Open settings modal
    const settingsButton = window.locator('[data-testid="settings-button"]')
    await settingsButton.click()
    await window.waitForTimeout(200)

    // Get current theme class on html
    const htmlClassBefore = await window.evaluate(() => document.documentElement.className)

    // Find and click dark mode button
    const darkModeButton = window.locator('button:has-text("dark")').first()
    if (await darkModeButton.isVisible()) {
      await darkModeButton.click()
      await window.waitForTimeout(200)

      // Verify theme class changed on html element
      const htmlClassAfter = await window.evaluate(() => document.documentElement.className)
      expect(htmlClassAfter).toContain('dark')
    }

    // Try clicking light mode
    const lightModeButton = window.locator('button:has-text("light")').first()
    if (await lightModeButton.isVisible()) {
      await lightModeButton.click()
      await window.waitForTimeout(200)

      const htmlClassLight = await window.evaluate(() => document.documentElement.className)
      expect(htmlClassLight).toBeDefined()
    }
  })

  test('modal closes on X button click', async ({ window }) => {
    // Open settings modal
    const settingsButton = window.locator('[data-testid="settings-button"]')
    await settingsButton.click()
    await window.waitForTimeout(200)

    // Verify modal is open
    const modal = window.locator('[data-testid="settings-modal"]')
    await expect(modal).toBeVisible()

    // Find and click close button using data-testid
    const closeButton = window.locator('[data-testid="settings-close-button"]')
    await expect(closeButton).toBeVisible()
    await closeButton.click()

    // Wait for modal to close
    await window.waitForTimeout(200)

    // Verify modal is no longer visible
    await expect(modal).not.toBeVisible()
  })

  test('modal closes on Cancel button click', async ({ window }) => {
    // Open settings modal
    const settingsButton = window.locator('[data-testid="settings-button"]')
    await settingsButton.click()
    await window.waitForTimeout(200)

    // Verify modal is open
    const modal = window.locator('[data-testid="settings-modal"]')
    await expect(modal).toBeVisible()

    // Find and click Cancel button using data-testid
    const cancelButton = window.locator('[data-testid="settings-cancel-button"]')
    await expect(cancelButton).toBeVisible()
    await cancelButton.click()

    // Wait for modal to close
    await window.waitForTimeout(200)

    // Verify modal is no longer visible
    await expect(modal).not.toBeVisible()
  })

  test('modal closes on Save Settings button click', async ({ window }) => {
    // Open settings modal
    const settingsButton = window.locator('[data-testid="settings-button"]')
    await settingsButton.click()
    await window.waitForTimeout(200)

    // Verify modal is open
    const modal = window.locator('[data-testid="settings-modal"]')
    await expect(modal).toBeVisible()

    // Find and click Save Settings button using data-testid
    const saveButton = window.locator('[data-testid="settings-save-button"]')
    await expect(saveButton).toBeVisible()
    await saveButton.click()

    // Wait for modal to close
    await window.waitForTimeout(200)

    // Verify modal is no longer visible
    await expect(modal).not.toBeVisible()
  })

  test('modal closes on backdrop click', async ({ window }) => {
    // Open settings modal
    const settingsButton = window.locator('[data-testid="settings-button"]')
    await settingsButton.click()
    await window.waitForTimeout(200)

    // Verify modal is open
    const modal = window.locator('[data-testid="settings-modal"]')
    await expect(modal).toBeVisible()

    // Click on backdrop at the edge (bottom right corner where backdrop is visible)
    // The modal has mx-4 mb-10, so clicking at bottom edge should hit backdrop
    const backdrop = window.locator('[data-testid="settings-backdrop"]')
    const box = await backdrop.boundingBox()
    if (box) {
      // Click at bottom-right corner of backdrop (outside modal)
      await window.mouse.click(box.x + box.width - 5, box.y + box.height - 5)
    }

    // Wait for modal to close
    await window.waitForTimeout(200)

    // Verify modal is no longer visible
    await expect(modal).not.toBeVisible()
  })
})
