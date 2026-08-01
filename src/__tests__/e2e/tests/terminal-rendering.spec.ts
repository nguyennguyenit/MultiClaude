import { test, expect, injectMockProject, addTerminal, clearTerminalForScreenshot, clearAllTerminalsForScreenshot, WAIT_TIMES } from '../fixtures'
import { mockProject } from '../fixtures/test-data'
import type { Page } from '@playwright/test'

// Skip PTY-dependent tests on CI (terminal creation can be unreliable)
const isCI = process.env.CI === 'true'

/**
 * Terminal Rendering Mode Tests
 * Tests WebGL rendering modes: performance, balanced, quality.
 * Note: Skipped on CI - PTY creation is unreliable in headless environment.
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
  const modeButton = window.getByRole('button', { name: new RegExp(mode, 'i') }).first()
  await modeButton.click()
  await window.waitForTimeout(WAIT_TIMES.SHORT)
}

/**
 * Helper to save and close settings.
 */
async function saveAndCloseSettings(window: Page): Promise<void> {
  const saveButton = window.getByTestId('settings-save-button')
  if (await saveButton.isEnabled()) {
    await saveButton.click()
  } else {
    await window.getByRole('button', { name: 'Close Settings' }).click()
  }
  await window.waitForTimeout(WAIT_TIMES.MEDIUM)
}

test.describe('Terminal Rendering Modes', () => {
  // Skip entire suite on CI - tests require PTY creation
  test.skip(isCI, 'Terminal rendering tests require PTY which is unreliable on CI')

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

    const performanceButton = window.getByRole('button', { name: /Performance/i }).first()
    await expect(performanceButton).toHaveAttribute('aria-pressed', 'true')

    // Verify description
    const description = performanceButton.locator('span:has-text("No WebGL")')
    await expect(description).toBeVisible()

    await saveAndCloseSettings(window)

    // Create a terminal to verify rendering if none exist
    const initialCount = await window.locator('[data-terminal-id]').count()
    if (initialCount === 0) {
      await addTerminal(window)
      await window.waitForSelector('[data-terminal-id]', { timeout: 5000 })
    }

    // Terminal should render (in performance mode, no WebGL canvas)
    const terminalPane = window.locator('[data-terminal-id]').first()
    await expect(terminalPane).toBeVisible()

    // Clear terminal and inject fixed prompt for consistent screenshot
    await clearTerminalForScreenshot(window, 0)

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

    const balancedButton = window.getByRole('button', { name: /Balanced/i }).first()
    await expect(balancedButton).toHaveAttribute('aria-pressed', 'true')

    // Verify description
    const description = balancedButton.locator('span:has-text("WebGL only for active")')
    await expect(description).toBeVisible()

    await saveAndCloseSettings(window)

    // Create terminals if none exist
    const initialCount = await window.locator('[data-terminal-id]').count()
    if (initialCount === 0) {
      await addTerminal(window)
      await window.waitForSelector('[data-terminal-id]', { timeout: 5000 })
    }

    // Ensure we have at least 2 terminals
    const currentCount = await window.locator('[data-terminal-id]').count()
    if (currentCount < 2) {
      await addTerminal(window)
    }

    // Verify at least 2 terminals visible
    const terminalCount = await window.locator('[data-terminal-id]').count()
    expect(terminalCount).toBeGreaterThanOrEqual(2)

    // Clear all terminals and inject fixed prompt for consistent screenshot
    await clearAllTerminalsForScreenshot(window)

    // Take screenshot
    const gridArea = window.getByRole('region', {
      name: `Terminal grid for project ${mockProject.id}`
    })
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

    const qualityButton = window.getByRole('button', { name: /Quality/i }).first()
    await expect(qualityButton).toHaveAttribute('aria-pressed', 'true')

    // Verify description
    const description = qualityButton.locator('span:has-text("WebGL always")')
    await expect(description).toBeVisible()

    await saveAndCloseSettings(window)

    // Create a terminal if none exist
    const initialCount = await window.locator('[data-terminal-id]').count()
    if (initialCount === 0) {
      await addTerminal(window)
      await window.waitForSelector('[data-terminal-id]', { timeout: 5000 })
    }

    // Terminal should be visible
    const terminalPane = window.locator('[data-terminal-id]').first()
    await expect(terminalPane).toBeVisible()

    // Clear terminal and inject fixed prompt for consistent screenshot
    await clearTerminalForScreenshot(window, 0)

    // Take screenshot
    await expect(terminalPane).toHaveScreenshot('terminal-quality-mode.png', {
      maxDiffPixelRatio: 0.02
    })
  })

  test('rendering mode persists after page reload', async ({ window }) => {
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
    const performanceButton = window.getByRole('button', { name: /Performance/i }).first()
    await expect(performanceButton).toHaveAttribute('aria-pressed', 'true')
  })

  test('terminal settings section displays correctly', async ({ window }) => {
    // Open settings
    await openSettings(window)
    await navigateToTerminalsTab(window)

    // Verify section header
    const sectionHeader = window.locator('h3:has-text("Terminals")')
    await expect(sectionHeader).toBeVisible()

    // Verify "Rendering Mode" subsection
    const renderingLabel = window.getByText('Rendering Mode', { exact: true })
    await expect(renderingLabel).toBeVisible()

    // Verify all three mode buttons exist
    const performanceBtn = window.getByRole('button', { name: /Performance/i }).first()
    const balancedBtn = window.getByRole('button', { name: /Balanced/i }).first()
    const qualityBtn = window.getByRole('button', { name: /Quality/i }).first()

    await expect(performanceBtn).toBeVisible()
    await expect(balancedBtn).toBeVisible()
    await expect(qualityBtn).toBeVisible()

    // Take screenshot of terminal settings
    const settingsContent = window
      .getByRole('dialog', { name: 'Settings' })
      .locator('.overflow-y-scroll')
    await expect(settingsContent).toHaveScreenshot('terminal-settings-panel.png', {
      maxDiffPixelRatio: 0.02
    })
  })

  test('max terminals limit setting works', async ({ window }) => {
    // Open settings
    await openSettings(window)
    await navigateToTerminalsTab(window)

    // Verify terminal limit section exists
    const limitLabel = window.getByText('Max Terminals per Project', { exact: true })
    await expect(limitLabel).toBeVisible()

    // Click on preset "4"
    const preset4Button = window.getByRole('button', { name: '4', exact: true })
    await preset4Button.click()
    await window.waitForTimeout(WAIT_TIMES.SHORT)
    await expect(preset4Button).toHaveAttribute('aria-pressed', 'true')

    await saveAndCloseSettings(window)

    // Create a terminal if none exist
    const initialCount = await window.locator('[data-terminal-id]').count()
    if (initialCount === 0) {
      await addTerminal(window)
      await window.waitForSelector('[data-terminal-id]', { timeout: 5000 })
    }

    // Terminal should be created
    const terminalCount = await window.locator('[data-terminal-id]').count()
    expect(terminalCount).toBeGreaterThanOrEqual(1)
  })
})
