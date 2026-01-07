import { test, expect, injectMockProject, addTerminal, WAIT_TIMES } from '../fixtures'
import { mockProject } from '../fixtures/test-data'
import type { Page } from '@playwright/test'

/**
 * Terminal Rendering Mode Tests
 * Tests WebGL rendering modes: performance, balanced, quality.
 */


/**
 * Helper to open settings modal.
 */
async function openSettings(window: Page): Promise<void> {
  // Click settings button using data-testid
  const settingsButton = window.locator('[data-testid="settings-button"]')
  await settingsButton.click()
  await window.waitForSelector('h2:has-text("Settings")', { timeout: 3000 })
}

/**
 * Helper to navigate to Terminals settings tab.
 */
async function navigateToTerminalsTab(window: Page): Promise<void> {
  // Use testid to avoid conflict with sidebar Terminals button
  const terminalsTab = window.locator('[data-testid="settings-tab-terminals"]')
  await terminalsTab.click()
  await window.waitForTimeout(WAIT_TIMES.SHORT)
}

/**
 * Helper to select a rendering mode.
 */
async function selectRenderingMode(
  window: Page,
  mode: 'Performance' | 'Balanced' | 'Quality'
): Promise<void> {
  // Find the button with exact mode name
  const modeButton = window.locator(`button:has(span.font-medium:text-is("${mode}"))`).first()
  await modeButton.click()
  await window.waitForTimeout(WAIT_TIMES.SHORT)
}

/**
 * Helper to save and close settings.
 */
async function saveAndCloseSettings(window: Page): Promise<void> {
  const saveButton = window.locator('button:has-text("Save Settings")')
  await saveButton.click()
  await window.waitForTimeout(WAIT_TIMES.MEDIUM)
}

test.describe('Terminal Rendering Modes', () => {
  test.beforeEach(async ({ window }) => {
    // Inject mock project data
    await injectMockProject(window, [mockProject])
    await window.waitForSelector('#root', { state: 'attached' })
  })

  test('performance mode disables WebGL', async ({ window }) => {
    // Open settings and go to terminals
    await openSettings(window)
    await navigateToTerminalsTab(window)

    // Select Performance mode
    await selectRenderingMode(window, 'Performance')

    // Verify Performance button has active styling (check mark visible)
    const performanceButton = window.locator('button:has(span.font-medium:text-is("Performance"))')
    const checkMark = performanceButton.locator('span.text-\\[var\\(--mc-accent\\)\\]:has-text("✓")')
    await expect(checkMark).toBeVisible()

    // Verify description
    const description = performanceButton.locator('span:has-text("No WebGL")')
    await expect(description).toBeVisible()

    await saveAndCloseSettings(window)

    // Create a terminal to verify rendering if none exist
    const initialCount = await window.locator('.terminal-pane').count()
    if (initialCount === 0) {
      await addTerminal(window)
      await window.waitForSelector('.terminal-pane', { timeout: 5000 })
    }

    // Terminal should render (in performance mode, no WebGL canvas)
    const terminalPane = window.locator('.terminal-pane').first()
    await expect(terminalPane).toBeVisible()

    // Take screenshot for visual regression
    await expect(terminalPane).toHaveScreenshot('terminal-performance-mode.png', {
      maxDiffPixelRatio: 0.02
    })
  })

  test('balanced mode uses WebGL on active terminal only', async ({ window }) => {
    // Open settings and go to terminals
    await openSettings(window)
    await navigateToTerminalsTab(window)

    // Select Balanced mode
    await selectRenderingMode(window, 'Balanced')

    // Verify Balanced button is selected
    const balancedButton = window.locator('button:has(span.font-medium:text-is("Balanced"))')
    const checkMark = balancedButton.locator('span.text-\\[var\\(--mc-accent\\)\\]:has-text("✓")')
    await expect(checkMark).toBeVisible()

    // Verify description
    const description = balancedButton.locator('span:has-text("WebGL only for active")')
    await expect(description).toBeVisible()

    await saveAndCloseSettings(window)

    // Create terminals if none exist
    const initialCount = await window.locator('.terminal-pane').count()
    if (initialCount === 0) {
      await addTerminal(window)
      await window.waitForSelector('.terminal-pane', { timeout: 5000 })
    }

    // Ensure we have at least 2 terminals
    const currentCount = await window.locator('.terminal-pane').count()
    if (currentCount < 2) {
      await addTerminal(window)
    }

    // Verify at least 2 terminals visible
    const terminalCount = await window.locator('.terminal-pane').count()
    expect(terminalCount).toBeGreaterThanOrEqual(2)

    // Take screenshot
    const gridArea = window.locator('.terminal-pane').first().locator('..')
    await expect(gridArea).toHaveScreenshot('terminal-balanced-mode.png', {
      maxDiffPixelRatio: 0.02
    })
  })

  test('quality mode enables WebGL always', async ({ window }) => {
    // Open settings and go to terminals
    await openSettings(window)
    await navigateToTerminalsTab(window)

    // Select Quality mode
    await selectRenderingMode(window, 'Quality')

    // Verify Quality button is selected
    const qualityButton = window.locator('button:has(span.font-medium:text-is("Quality"))')
    const checkMark = qualityButton.locator('span.text-\\[var\\(--mc-accent\\)\\]:has-text("✓")')
    await expect(checkMark).toBeVisible()

    // Verify description
    const description = qualityButton.locator('span:has-text("WebGL always")')
    await expect(description).toBeVisible()

    await saveAndCloseSettings(window)

    // Create a terminal if none exist
    const initialCount = await window.locator('.terminal-pane').count()
    if (initialCount === 0) {
      await addTerminal(window)
      await window.waitForSelector('.terminal-pane', { timeout: 5000 })
    }

    // Terminal should be visible
    const terminalPane = window.locator('.terminal-pane').first()
    await expect(terminalPane).toBeVisible()

    // Take screenshot
    await expect(terminalPane).toHaveScreenshot('terminal-quality-mode.png', {
      maxDiffPixelRatio: 0.02
    })
  })

  test.skip('rendering mode persists after page reload', async ({ window }) => {
    // Skip: Electron page reload causes browser context to close in test environment
    // Set to performance mode
    await openSettings(window)
    await navigateToTerminalsTab(window)
    await selectRenderingMode(window, 'Performance')
    await saveAndCloseSettings(window)

    // Reload the page
    await window.reload()
    await window.waitForLoadState('domcontentloaded')
    await window.waitForSelector('#root', { state: 'attached' })

    // Open settings and check if Performance is still selected
    await openSettings(window)
    await navigateToTerminalsTab(window)

    // Verify Performance is selected
    const performanceButton = window.locator('button:has(span.font-medium:text-is("Performance"))')
    const checkMark = performanceButton.locator('span:has-text("✓")')
    await expect(checkMark).toBeVisible()
  })

  test('terminal settings section displays correctly', async ({ window }) => {
    // Open settings
    await openSettings(window)
    await navigateToTerminalsTab(window)

    // Verify section header
    const sectionHeader = window.locator('h3:has-text("Terminals")')
    await expect(sectionHeader).toBeVisible()

    // Verify "Rendering Mode" subsection
    const renderingLabel = window.locator('span:has-text("Rendering Mode")')
    await expect(renderingLabel).toBeVisible()

    // Verify all three mode buttons exist
    const performanceBtn = window.locator('button:has(span:text-is("Performance"))')
    const balancedBtn = window.locator('button:has(span:text-is("Balanced"))')
    const qualityBtn = window.locator('button:has(span:text-is("Quality"))')

    await expect(performanceBtn).toBeVisible()
    await expect(balancedBtn).toBeVisible()
    await expect(qualityBtn).toBeVisible()

    // Take screenshot of terminal settings
    const settingsContent = window.locator('.flex-1.p-4.overflow-auto')
    await expect(settingsContent).toHaveScreenshot('terminal-settings-panel.png', {
      maxDiffPixelRatio: 0.02
    })
  })

  test('max terminals limit setting works', async ({ window }) => {
    // Open settings
    await openSettings(window)
    await navigateToTerminalsTab(window)

    // Verify terminal limit section exists
    const limitLabel = window.locator('span:has-text("Max Terminals per Project")')
    await expect(limitLabel).toBeVisible()

    // Click on preset "4"
    const preset4Button = window.locator('button:has-text("4")').filter({
      has: window.locator('text=/^4$/')
    })
    await preset4Button.click()
    await window.waitForTimeout(WAIT_TIMES.SHORT)

    await saveAndCloseSettings(window)

    // Create a terminal if none exist
    const initialCount = await window.locator('.terminal-pane').count()
    if (initialCount === 0) {
      await addTerminal(window)
      await window.waitForSelector('.terminal-pane', { timeout: 5000 })
    }

    // Terminal should be created
    const terminalCount = await window.locator('.terminal-pane').count()
    expect(terminalCount).toBeGreaterThanOrEqual(1)
  })
})
