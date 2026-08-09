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

  test('modal displays all six settings sections', async ({ window }) => {
    // Open settings modal
    const settingsButton = window.locator('[data-testid="settings-button"]')
    await settingsButton.click()
    await window.waitForTimeout(200)

    // Verify the complete current information architecture.
    await expect(window.locator('[data-testid="settings-tab-appearance"]')).toBeVisible()
    await expect(window.locator('[data-testid="settings-tab-terminals"]')).toBeVisible()
    await expect(window.locator('[data-testid="settings-tab-notifications"]')).toBeVisible()
    await expect(window.locator('[data-testid="settings-tab-diagnostics"]')).toBeVisible()
    await expect(window.locator('[data-testid="settings-tab-agents-integrations"]')).toBeVisible()
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

  test('theme selector changes color theme', async ({ window }) => {
    const settingsButton = window.locator('[data-testid="settings-button"]')
    await settingsButton.click()
    await window.waitForTimeout(200)

    const saveButton = window.locator('[data-testid="settings-save-button"]')
    await expect(saveButton).toBeDisabled()

    const draculaButton = window.getByRole('button', { name: /Dracula/i })
    await draculaButton.click()
    await window.waitForTimeout(200)

    await expect(draculaButton).toHaveAttribute('aria-pressed', 'true')
    await expect(saveButton).toBeEnabled()

    const accentColor = await window.evaluate(() =>
      getComputedStyle(document.documentElement).getPropertyValue('--accent').trim()
    )
    expect(accentColor.toLowerCase()).toBe('#bd93f9')
  })

  test('appearance mode stays selected after an unavailable saved shell is reconciled', async ({ window }) => {
    await window.evaluate(async () => {
      await globalThis.window.electron.settings.set({
        defaultShell: {
          path: '/definitely/missing-shell',
          name: 'Missing shell',
          isDefault: false,
          kind: 'unix',
        },
      })
    })
    await window.reload()
    await window.waitForLoadState('domcontentloaded')
    await injectMockProject(window, [mockProject])

    await expect.poll(() => window.evaluate(async () =>
      (await globalThis.window.electron.settings.get()).defaultShell
    )).toBeUndefined()

    await window.locator('[data-testid="settings-button"]').click()
    const lightModeButton = window
      .getByRole('group', { name: 'Appearance Mode' })
      .getByRole('button', { name: 'light', exact: true })
    await lightModeButton.click()
    await window.waitForTimeout(600)

    await expect(lightModeButton).toHaveAttribute('aria-pressed', 'true')
    await expect(window.locator('html')).toHaveAttribute('data-theme-mode', 'light')
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

    const modeGroup = window.getByRole('group', { name: 'Appearance Mode' })
    const lightModeButton = modeGroup.getByRole('button', { name: 'light', exact: true })
    await lightModeButton.click()

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

  test('notification changes enable Save Settings', async ({ window }) => {
    const settingsButton = window.locator('[data-testid="settings-button"]')
    await settingsButton.click()
    await window.waitForTimeout(200)

    await window.locator('[data-testid="settings-tab-notifications"]').click()
    await window.waitForTimeout(100)

    const saveButton = window.locator('[data-testid="settings-save-button"]')
    await expect(saveButton).toBeDisabled()

    const notificationToggle = window.getByRole('switch', { name: 'On Task Complete' })

    const initialState = await notificationToggle.getAttribute('aria-checked')
    await notificationToggle.click()
    await window.waitForTimeout(100)

    await expect(notificationToggle).toHaveAttribute(
      'aria-checked',
      initialState === 'true' ? 'false' : 'true'
    )
    await expect(saveButton).toBeEnabled()
  })
})

/**
 * Terminal UI Style E2E tests.
 * Tests terminal style toggle, color presets, fonts, and border options.
 */
test.describe('Terminal and renderer settings', () => {
  test.beforeEach(async ({ window }) => {
    await injectMockProject(window, [mockProject])
    await window.waitForTimeout(200)
  })

  test('keeps renderer policy out of Terminal Settings', async ({ window }) => {
    const settingsButton = window.locator('[data-testid="settings-button"]')
    await settingsButton.click()
    await window.waitForTimeout(300)

    await window.locator('[data-testid="settings-tab-terminals"]').click()
    await window.waitForTimeout(200)

    await expect(window.getByText('Rendering Mode', { exact: true })).toHaveCount(0)
    await expect(window.getByText('Use GPU renderer for Claude terminals', { exact: true })).toHaveCount(0)
    await expect(window.getByRole('radio', { name: 'Automatic (Recommended)' })).toHaveCount(0)
  })

  test('shows canonical policy copy and accessible radios in Diagnostics', async ({ window }) => {
    const settingsButton = window.locator('[data-testid="settings-button"]')
    await settingsButton.click()
    await window.waitForTimeout(300)

    await window.locator('[data-testid="settings-tab-diagnostics"]').click()
    await window.waitForTimeout(200)

    const group = window.getByRole('radiogroup', { name: 'Terminal renderer policy' })
    await expect(group).toBeVisible()
    await expect(group.getByRole('radio', { name: 'Automatic (Recommended)', exact: true })).toBeChecked()
    await expect(group.getByRole('radio', { name: 'Prefer GPU', exact: true })).toBeVisible()
    await expect(group.getByRole('radio', { name: 'Compatibility', exact: true })).toBeVisible()
    await expect(window.getByText('WebGL for regular shells; safer non-WebGL rendering for Claude and Codex.')).toBeVisible()
    await expect(window.getByText('Attempts WebGL for all terminals and falls back automatically.')).toBeVisible()
    await expect(window.getByText('Disables WebGL for maximum compatibility.')).toBeVisible()
  })

  test('Cancel restores the saved renderer policy', async ({ window }) => {
    const settingsButton = window.locator('[data-testid="settings-button"]')
    await settingsButton.click()
    await window.waitForTimeout(300)

    await window.locator('[data-testid="settings-tab-diagnostics"]').click()
    await window.waitForTimeout(200)

    await window.getByRole('radio', { name: 'Compatibility', exact: true }).check()
    await expect(window.getByTestId('settings-save-button')).toBeEnabled()
    await window.getByTestId('settings-cancel-button').click()
    await expect(window.getByTestId('settings-modal')).not.toBeVisible()

    await window.getByTestId('settings-button').click()
    await window.getByTestId('settings-tab-diagnostics').click()
    await expect(window.getByRole('radio', { name: 'Automatic (Recommended)', exact: true })).toBeChecked()
  })

  test('saves the canonical policy and restores it after reload', async ({ window }) => {
    const settingsButton = window.locator('[data-testid="settings-button"]')
    await settingsButton.click()
    await window.waitForTimeout(300)

    await window.locator('[data-testid="settings-tab-diagnostics"]').click()
    await window.waitForTimeout(200)

    await window.getByRole('radio', { name: 'Prefer GPU', exact: true }).check()
    await window.getByTestId('settings-save-button').click()
    await expect(window.getByTestId('settings-modal')).not.toBeVisible()

    const savedPolicy = await window.evaluate(async () =>
      (await globalThis.window.electron.settings.get()).terminalRendererPolicy
    )
    expect(savedPolicy).toBe('prefer-gpu')

    await window.reload()
    await window.waitForLoadState('domcontentloaded')
    await injectMockProject(window, [mockProject])
    await window.getByTestId('settings-button').click()
    await window.getByTestId('settings-tab-diagnostics').click()
    await expect(window.getByRole('radio', { name: 'Prefer GPU', exact: true })).toBeChecked()
  })

  test('main sanitizes a non-canonical renderer policy', async ({ window }) => {
    const canonical = await window.evaluate(async () =>
      globalThis.window.electron.settings.set({
        terminalRendererPolicy: 'retired-quality',
      } as never)
    )

    expect(canonical.terminalRendererPolicy).toBe('automatic')
    const saved = await window.evaluate(async () => globalThis.window.electron.settings.get())
    expect(saved.terminalRendererPolicy).toBe('automatic')
  })

  test('should update max terminal preset badge', async ({ window }) => {
    const settingsButton = window.locator('[data-testid="settings-button"]')
    await settingsButton.click()
    await window.waitForTimeout(300)

    await window.locator('[data-testid="settings-tab-terminals"]').click()
    await window.waitForTimeout(200)

    const limitCard = window
      .locator('p:has-text("Max Terminals per Project")')
      .locator('xpath=ancestor::div[contains(@class,"settings-card")][1]')

    await limitCard.getByRole('button', { name: '4' }).click()
    await window.waitForTimeout(300)

    await expect(limitCard.locator('span').first()).toHaveText('4 max')
  })

  test('should change terminal font', async ({ window }) => {
    const settingsButton = window.locator('[data-testid="settings-button"]')
    await settingsButton.click()
    await window.waitForTimeout(300)

    const fontCard = window
      .locator('p:has-text("Terminal Font")')
      .locator('xpath=ancestor::div[contains(@class,"settings-card")][1]')
    const fontSelect = fontCard.locator('select')
    await fontSelect.selectOption('vt323')
    await window.waitForTimeout(300)

    const fontVar = await window.evaluate(() =>
      getComputedStyle(document.documentElement).getPropertyValue('--terminal-font')
    )
    expect(fontVar).toContain('VT323')
  })

  test('should update custom terminal limit value', async ({ window }) => {
    const settingsButton = window.locator('[data-testid="settings-button"]')
    await settingsButton.click()
    await window.waitForTimeout(300)

    await window.locator('[data-testid="settings-tab-terminals"]').click()
    await window.waitForTimeout(200)

    const limitCard = window
      .locator('p:has-text("Max Terminals per Project")')
      .locator('xpath=ancestor::div[contains(@class,"settings-card")][1]')

    await limitCard.getByRole('button', { name: 'Custom' }).click()
    const customInput = limitCard.locator('input[type="number"]')
    await customInput.fill('12')
    await window.waitForTimeout(300)

    await expect(limitCard.locator('span').first()).toHaveText('12 max')
  })

})
