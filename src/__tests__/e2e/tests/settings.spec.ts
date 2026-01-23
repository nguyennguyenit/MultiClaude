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

    // Make a change to enable Save button (toggle theme mode)
    // Click a theme mode button (light/dark/system) that's not currently selected
    const darkModeButton = window.locator('button:has-text("dark")').first()
    const lightModeButton = window.locator('button:has-text("light")').first()

    // Toggle to a different mode to create unsaved changes
    if (await darkModeButton.isVisible()) {
      await darkModeButton.click()
      await window.waitForTimeout(100)
    } else if (await lightModeButton.isVisible()) {
      await lightModeButton.click()
      await window.waitForTimeout(100)
    }

    // Find and click Save Settings button using data-testid
    const saveButton = window.locator('[data-testid="settings-save-button"]')
    await expect(saveButton).toBeVisible()
    await expect(saveButton).toBeEnabled()
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

/**
 * Terminal UI Style E2E tests.
 * Tests terminal style toggle, color presets, fonts, and border options.
 */
test.describe('Terminal UI Style', () => {
  test.beforeEach(async ({ window }) => {
    await injectMockProject(window, [mockProject])
    await window.waitForTimeout(200)
  })

  test('should toggle to terminal UI style', async ({ window }) => {
    // Open settings modal
    const settingsButton = window.locator('[data-testid="settings-button"]')
    await settingsButton.click()
    await window.waitForTimeout(300)

    // Wait for UI Style section to be visible
    await window.waitForSelector('text=UI Style', { timeout: 5000 })

    // Click Terminal style button (in UI Style section, not tab)
    const terminalButton = window.locator('button[aria-label="Select Terminal UI style"]')
    await expect(terminalButton).toBeVisible({ timeout: 5000 })
    await terminalButton.click()
    await window.waitForTimeout(300)

    // Verify ui-terminal class applied to html
    const htmlClass = await window.evaluate(() => document.documentElement.className)
    expect(htmlClass).toContain('ui-terminal')
  })

  test('should show Terminal Style Options when terminal mode selected', async ({ window }) => {
    // Open settings modal
    const settingsButton = window.locator('[data-testid="settings-button"]')
    await settingsButton.click()
    await window.waitForTimeout(300)

    // Wait for UI Style section
    await window.waitForSelector('text=UI Style', { timeout: 5000 })

    // Click Terminal style button
    const terminalButton = window.locator('button[aria-label="Select Terminal UI style"]')
    await terminalButton.click()
    await window.waitForTimeout(300)

    // Verify Terminal Style Options section is visible
    const colorPresetSection = window.locator('text=Terminal Color Preset')
    await expect(colorPresetSection).toBeVisible({ timeout: 5000 })

    const fontSection = window.locator('text=Terminal Font')
    await expect(fontSection).toBeVisible()

    const borderSection = window.locator('text=Border Style')
    await expect(borderSection).toBeVisible()
  })

  test('should disable Color Theme section in terminal mode', async ({ window }) => {
    // Open settings modal
    const settingsButton = window.locator('[data-testid="settings-button"]')
    await settingsButton.click()
    await window.waitForTimeout(300)

    // Wait for UI Style section
    await window.waitForSelector('text=UI Style', { timeout: 5000 })

    // Click Terminal style button
    const terminalButton = window.locator('button[aria-label="Select Terminal UI style"]')
    await terminalButton.click()
    await window.waitForTimeout(300)

    // Verify "Disabled in Terminal mode" text is visible
    const disabledText = window.locator('text=Disabled in Terminal mode')
    await expect(disabledText).toBeVisible({ timeout: 5000 })
  })

  test('should switch back to modern UI style', async ({ window }) => {
    // Open settings modal and switch to terminal first
    const settingsButton = window.locator('[data-testid="settings-button"]')
    await settingsButton.click()
    await window.waitForTimeout(300)

    // Wait for UI Style section
    await window.waitForSelector('text=UI Style', { timeout: 5000 })

    const terminalButton = window.locator('button[aria-label="Select Terminal UI style"]')
    await terminalButton.click()
    await window.waitForTimeout(300)

    // Now switch back to Modern
    const modernButton = window.locator('button[aria-label="Select Modern UI style"]')
    await modernButton.click()
    await window.waitForTimeout(300)

    // Verify ui-terminal class removed
    const htmlClass = await window.evaluate(() => document.documentElement.className)
    expect(htmlClass).not.toContain('ui-terminal')
  })

  test('should change terminal color preset', async ({ window }) => {
    // Open settings modal
    const settingsButton = window.locator('[data-testid="settings-button"]')
    await settingsButton.click()
    await window.waitForTimeout(300)

    // Wait for UI Style section
    await window.waitForSelector('text=UI Style', { timeout: 5000 })

    // Switch to terminal mode
    const terminalButton = window.locator('button[aria-label="Select Terminal UI style"]')
    await terminalButton.click()
    await window.waitForTimeout(300)

    // Wait for color presets to be visible
    await window.waitForSelector('text=Terminal Color Preset', { timeout: 5000 })

    // Click Blue preset
    const bluePreset = window.locator('button[aria-label="Select Blue color preset"]')
    await bluePreset.click()
    await window.waitForTimeout(300)

    // Verify terminal-preset-blue class applied
    const htmlClass = await window.evaluate(() => document.documentElement.className)
    expect(htmlClass).toContain('terminal-preset-blue')
  })

  test('should change terminal font', async ({ window }) => {
    // Open settings modal
    const settingsButton = window.locator('[data-testid="settings-button"]')
    await settingsButton.click()
    await window.waitForTimeout(300)

    // Wait for UI Style section
    await window.waitForSelector('text=UI Style', { timeout: 5000 })

    // Switch to terminal mode
    const terminalButton = window.locator('button[aria-label="Select Terminal UI style"]')
    await terminalButton.click()
    await window.waitForTimeout(300)

    // Wait for font selector to be visible
    await window.waitForSelector('text=Terminal Font', { timeout: 5000 })

    // Select VT323 font
    const fontSelect = window.locator('#terminal-font-select')
    await fontSelect.selectOption('vt323')
    await window.waitForTimeout(300)

    // Verify font CSS variable is set
    const fontVar = await window.evaluate(() =>
      getComputedStyle(document.documentElement).getPropertyValue('--mc-terminal-font')
    )
    expect(fontVar).toContain('VT323')
  })

  test('should toggle ASCII border style', async ({ window }) => {
    // Open settings modal
    const settingsButton = window.locator('[data-testid="settings-button"]')
    await settingsButton.click()
    await window.waitForTimeout(300)

    // Wait for UI Style section
    await window.waitForSelector('text=UI Style', { timeout: 5000 })

    // Switch to terminal mode
    const terminalButton = window.locator('button[aria-label="Select Terminal UI style"]')
    await terminalButton.click()
    await window.waitForTimeout(300)

    // Wait for border style section
    await window.waitForSelector('text=Border Style', { timeout: 5000 })

    // Click ASCII Box button
    const asciiBorderButton = window.locator('button[aria-label="Select ASCII Box border style"]')
    await asciiBorderButton.click()
    await window.waitForTimeout(300)

    // Verify use-border-chars class applied
    const htmlClass = await window.evaluate(() => document.documentElement.className)
    expect(htmlClass).toContain('use-border-chars')
  })

  test('should save and persist terminal settings', async ({ window }) => {
    // Open settings modal
    const settingsButton = window.locator('[data-testid="settings-button"]')
    await settingsButton.click()
    await window.waitForTimeout(300)

    // Wait for UI Style section
    await window.waitForSelector('text=UI Style', { timeout: 5000 })

    // Switch to terminal mode
    const terminalButton = window.locator('button[aria-label="Select Terminal UI style"]')
    await terminalButton.click()
    await window.waitForTimeout(300)

    // Click Save button
    const saveButton = window.locator('[data-testid="settings-save-button"]')
    await saveButton.click()
    await window.waitForTimeout(300)

    // Verify modal closed
    const modal = window.locator('[data-testid="settings-modal"]')
    await expect(modal).not.toBeVisible()

    // Verify ui-terminal class still applied after modal closes
    const htmlClass = await window.evaluate(() => document.documentElement.className)
    expect(htmlClass).toContain('ui-terminal')
  })
})
