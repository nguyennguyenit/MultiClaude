import { test, expect, injectMockProject, mockProject } from '../fixtures'

// Skip terminal-dependent tests on CI (PTY creation can be unreliable)
const isCI = process.env.CI === 'true'

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
    // Skip on CI - these tests require PTY creation which is unreliable in headless CI
    test.skip(isCI, 'Terminal tests require PTY which is unreliable on CI')

    test.beforeEach(async ({ window }) => {
      // Ensure we have a terminal to test with
      const projectTab = window.locator('[data-testid="project-tab-test-project-1"]')
      await projectTab.click()
      await window.waitForTimeout(200)

      // Create a terminal if one doesn't exist
      const terminalCount = await window.locator('[data-terminal-id]').count()
      if (terminalCount === 0) {
        await window.keyboard.press('Control+n')
        await window.waitForTimeout(300)
      }
    })

    test('double-click enables title editing (input appears, focused)', async ({ window }) => {
      // Find terminal title span (the one with "Double-click to rename" tooltip)
      const terminalTitle = window.locator('[data-terminal-id] [title="Double-click to rename"]').first()
      await expect(terminalTitle).toBeVisible()

      // Double-click to enable editing
      await terminalTitle.dblclick()
      await window.waitForTimeout(100)

      // Verify input field appears and is focused
      const titleInput = window.locator('[data-terminal-id] .pane-tab-name-input').first()
      await expect(titleInput).toBeVisible()
      await expect(titleInput).toBeFocused()
    })

    test('Enter saves new title', async ({ window }) => {
      // Find and double-click terminal title
      const terminalTitle = window.locator('[data-terminal-id] [title="Double-click to rename"]').first()
      await terminalTitle.dblclick()
      await window.waitForTimeout(100)

      // Get input and change title
      const titleInput = window.locator('[data-terminal-id] .pane-tab-name-input').first()
      await titleInput.fill('New Terminal Name')
      await window.waitForTimeout(50)

      // Press Enter to save
      await titleInput.press('Enter')
      await window.waitForTimeout(100)

      // Verify input is gone and title is updated
      await expect(titleInput).not.toBeVisible()
      const updatedTitle = window.locator('[data-terminal-id] [title="Double-click to rename"]').first()
      await expect(updatedTitle).toHaveText('New Terminal Name')
    })

    test('Escape cancels editing (reverts to original)', async ({ window }) => {
      // Find terminal title and get original text
      const terminalTitle = window.locator('[data-terminal-id] [title="Double-click to rename"]').first()
      const originalTitle = await terminalTitle.textContent()
      await terminalTitle.dblclick()
      await window.waitForTimeout(100)

      // Get input and change title
      const titleInput = window.locator('[data-terminal-id] .pane-tab-name-input').first()
      await titleInput.fill('Changed But Will Cancel')
      await window.waitForTimeout(50)

      // Press Escape to cancel
      await titleInput.press('Escape')
      await window.waitForTimeout(100)

      // Verify input is gone and title reverted to original
      await expect(titleInput).not.toBeVisible()
      const revertedTitle = window.locator('[data-terminal-id] [title="Double-click to rename"]').first()
      await expect(revertedTitle).toHaveText(originalTitle || '')
    })

    test('blur saves title (click elsewhere)', async ({ window }) => {
      // Find and double-click terminal title
      const terminalTitle = window.locator('[data-terminal-id] [title="Double-click to rename"]').first()
      await terminalTitle.dblclick()
      await window.waitForTimeout(100)

      // Get input and change title
      const titleInput = window.locator('[data-terminal-id] .pane-tab-name-input').first()
      await titleInput.fill('Blur Save Test')
      await window.waitForTimeout(50)

      // Click elsewhere to blur (click on terminal content area)
      const terminalContent = window.locator('[data-terminal-id]').first()
      await terminalContent.click({ position: { x: 100, y: 100 } })
      await window.waitForTimeout(100)

      // Verify title was saved
      const updatedTitle = window.locator('[data-terminal-id] [title="Double-click to rename"]').first()
      await expect(updatedTitle).toHaveText('Blur Save Test')
    })
  })

  test.describe('Settings Form Inputs', () => {
    test.beforeEach(async ({ window }) => {
      await window.locator('[data-testid="settings-button"]').click()
      await expect(window.locator('[data-testid="settings-modal"]')).toBeVisible()
    })

    test('terminal limit preset buttons accept clicks', async ({ window }) => {
      await window.locator('[data-testid="settings-tab-terminals"]').click()
      const limitCard = window
        .locator('p:has-text("Max Terminals per Project")')
        .locator('xpath=ancestor::div[contains(@class,"settings-card")][1]')
      const preset4Btn = limitCard.getByRole('button', { name: '4', exact: true })
      await preset4Btn.click()
      await expect(preset4Btn).toHaveAttribute('aria-pressed', 'true')
    })

    test('custom preset shows number input that accepts valid values', async ({ window }) => {
      // Navigate to Terminals tab
      await window.locator('[data-testid="settings-tab-terminals"]').click()

      const limitCard = window
        .locator('p:has-text("Max Terminals per Project")')
        .locator('xpath=ancestor::div[contains(@class,"settings-card")][1]')
      const customBtn = limitCard.getByRole('button', { name: 'Custom', exact: true })
      await customBtn.click()

      const customInput = limitCard.locator('input[type="number"][min="1"][max="99"]')
      await expect(customInput).toBeVisible()

      await customInput.fill('12')

      await expect(customInput).toHaveValue('12')
    })

    test('theme selector buttons respond to clicks', async ({ window }) => {
      await window.locator('[data-testid="settings-tab-appearance"]').click()
      const dracula = window.getByRole('button', { name: /Dracula/i })
      await dracula.click()
      await expect(dracula).toHaveAttribute('aria-pressed', 'true')
    })

    test('render mode buttons change selection', async ({ window }) => {
      await window.locator('[data-testid="settings-tab-terminals"]').click()
      const renderingCard = window
        .locator('p:has-text("Rendering Mode")')
        .locator('xpath=ancestor::div[contains(@class,"settings-card")][1]')
      const performanceBtn = renderingCard.getByRole('button', { name: /Performance/i })
      const balancedBtn = renderingCard.getByRole('button', { name: /Balanced/i })

      await performanceBtn.click()
      await expect(performanceBtn).toHaveAttribute('aria-pressed', 'true')

      await balancedBtn.click()
      await expect(balancedBtn).toHaveAttribute('aria-pressed', 'true')
      await expect(performanceBtn).toHaveAttribute('aria-pressed', 'false')
    })
  })
})
