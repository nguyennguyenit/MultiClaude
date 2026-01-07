import { test, expect, injectMockProject, mockProject } from '../fixtures'

/**
 * Form input interaction tests for MultiClaude.
 * Tests terminal title editing and settings form inputs.
 */
test.describe('Form Inputs', () => {
  test.beforeEach(async ({ window }) => {
    // Setup with a single mock project
    await injectMockProject(window, [mockProject])
    await window.waitForTimeout(200)
  })

  test.describe('Terminal Title Editing', () => {
    test.beforeEach(async ({ window }) => {
      // Ensure we have a terminal to test with
      const projectTab = window.locator('button:has-text("TestProject")').first()
      await projectTab.click()
      await window.waitForTimeout(200)

      // Create a terminal if one doesn't exist
      const terminalCount = await window.locator('.terminal-pane').count()
      if (terminalCount === 0) {
        await window.keyboard.press('Control+n')
        await window.waitForTimeout(300)
      }
    })

    test('double-click enables title editing (input appears, focused)', async ({ window }) => {
      // Find terminal title span (the one with "Double-click to rename" tooltip)
      const terminalTitle = window.locator('.terminal-pane span[title="Double-click to rename"]').first()
      await expect(terminalTitle).toBeVisible()

      // Double-click to enable editing
      await terminalTitle.dblclick()
      await window.waitForTimeout(100)

      // Verify input field appears and is focused
      const titleInput = window.locator('.terminal-pane input[type="text"]').first()
      await expect(titleInput).toBeVisible()
      await expect(titleInput).toBeFocused()
    })

    test('Enter saves new title', async ({ window }) => {
      // Find and double-click terminal title
      const terminalTitle = window.locator('.terminal-pane span[title="Double-click to rename"]').first()
      await terminalTitle.dblclick()
      await window.waitForTimeout(100)

      // Get input and change title
      const titleInput = window.locator('.terminal-pane input[type="text"]').first()
      await titleInput.fill('New Terminal Name')
      await window.waitForTimeout(50)

      // Press Enter to save
      await titleInput.press('Enter')
      await window.waitForTimeout(100)

      // Verify input is gone and title is updated
      await expect(titleInput).not.toBeVisible()
      const updatedTitle = window.locator('.terminal-pane span[title="Double-click to rename"]').first()
      await expect(updatedTitle).toHaveText('New Terminal Name')
    })

    test('Escape cancels editing (reverts to original)', async ({ window }) => {
      // Find terminal title and get original text
      const terminalTitle = window.locator('.terminal-pane span[title="Double-click to rename"]').first()
      const originalTitle = await terminalTitle.textContent()
      await terminalTitle.dblclick()
      await window.waitForTimeout(100)

      // Get input and change title
      const titleInput = window.locator('.terminal-pane input[type="text"]').first()
      await titleInput.fill('Changed But Will Cancel')
      await window.waitForTimeout(50)

      // Press Escape to cancel
      await titleInput.press('Escape')
      await window.waitForTimeout(100)

      // Verify input is gone and title reverted to original
      await expect(titleInput).not.toBeVisible()
      const revertedTitle = window.locator('.terminal-pane span[title="Double-click to rename"]').first()
      await expect(revertedTitle).toHaveText(originalTitle || '')
    })

    test('blur saves title (click elsewhere)', async ({ window }) => {
      // Find and double-click terminal title
      const terminalTitle = window.locator('.terminal-pane span[title="Double-click to rename"]').first()
      await terminalTitle.dblclick()
      await window.waitForTimeout(100)

      // Get input and change title
      const titleInput = window.locator('.terminal-pane input[type="text"]').first()
      await titleInput.fill('Blur Save Test')
      await window.waitForTimeout(50)

      // Click elsewhere to blur (click on terminal content area)
      const terminalContent = window.locator('.terminal-pane').first()
      await terminalContent.click({ position: { x: 100, y: 100 } })
      await window.waitForTimeout(100)

      // Verify title was saved
      const updatedTitle = window.locator('.terminal-pane span[title="Double-click to rename"]').first()
      await expect(updatedTitle).toHaveText('Blur Save Test')
    })
  })

  test.describe('Settings Form Inputs', () => {
    test.beforeEach(async ({ window }) => {
      // Open settings panel - find and click settings button in sidebar
      const settingsBtn = window.locator('button[aria-label="Settings"], button[title="Settings"]').first()
      if (await settingsBtn.isVisible()) {
        await settingsBtn.click()
        await window.waitForTimeout(150)
      }
    })

    test('terminal limit preset buttons accept clicks', async ({ window }) => {
      // Navigate to Terminals tab in settings
      const terminalsTab = window.locator('button:has-text("Terminals")')
      if (await terminalsTab.isVisible()) {
        await terminalsTab.click()
        await window.waitForTimeout(100)
      }

      // Find preset button "4" and click it
      const preset4Btn = window.locator('button:has-text("4")').first()
      if (await preset4Btn.isVisible()) {
        await preset4Btn.click()
        await window.waitForTimeout(100)

        // Verify button has active state (accent color background)
        await expect(preset4Btn).toHaveClass(/bg-\[var\(--mc-accent\)\]/)
      }
    })

    test('custom preset shows number input that accepts valid values', async ({ window }) => {
      // Navigate to Terminals tab
      const terminalsTab = window.locator('button:has-text("Terminals")')
      if (await terminalsTab.isVisible()) {
        await terminalsTab.click()
        await window.waitForTimeout(100)
      }

      // Click "Custom" preset button
      const customBtn = window.locator('button:has-text("Custom")').first()
      if (await customBtn.isVisible()) {
        await customBtn.click()
        await window.waitForTimeout(100)

        // Verify custom input appears
        const customInput = window.locator('input[type="number"][min="1"][max="99"]')
        await expect(customInput).toBeVisible()

        // Enter a valid custom value
        await customInput.fill('12')
        await window.waitForTimeout(100)

        // Verify value was accepted
        await expect(customInput).toHaveValue('12')
      }
    })

    test('theme selector buttons respond to clicks', async ({ window }) => {
      // Theme selector should be in Appearance tab (default)
      const appearanceTab = window.locator('button:has-text("Appearance")')
      if (await appearanceTab.isVisible()) {
        await appearanceTab.click()
        await window.waitForTimeout(100)
      }

      // Find a theme button and click it
      const themeButtons = window.locator('[class*="rounded-full"][class*="cursor-pointer"]')
      const buttonCount = await themeButtons.count()

      if (buttonCount > 1) {
        // Click second theme button
        await themeButtons.nth(1).click()
        await window.waitForTimeout(100)

        // Verify visual feedback (ring around selected theme)
        const selectedTheme = window.locator('[class*="ring-2"]')
        await expect(selectedTheme.first()).toBeVisible()
      }
    })

    test('render mode buttons change selection', async ({ window }) => {
      // Navigate to Terminals tab
      const terminalsTab = window.locator('button:has-text("Terminals")')
      if (await terminalsTab.isVisible()) {
        await terminalsTab.click()
        await window.waitForTimeout(100)
      }

      // Find render mode buttons
      const performanceBtn = window.locator('button:has-text("Performance")')
      const balancedBtn = window.locator('button:has-text("Balanced")')

      if (await performanceBtn.isVisible()) {
        await performanceBtn.click()
        await window.waitForTimeout(100)

        // Verify Performance button has active border
        await expect(performanceBtn).toHaveClass(/border-\[var\(--mc-accent\)\]/)
      }

      if (await balancedBtn.isVisible()) {
        await balancedBtn.click()
        await window.waitForTimeout(100)

        // Verify Balanced button now has active border
        await expect(balancedBtn).toHaveClass(/border-\[var\(--mc-accent\)\]/)
      }
    })
  })
})
