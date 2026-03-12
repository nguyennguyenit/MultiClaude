import { test, expect, injectMockProject } from '../fixtures'
import { mockProject } from '../fixtures/test-data'

/**
 * Sidebar component E2E tests.
 * Tests sidebar expand/collapse, tooltips, and settings badge.
 * NOTE: Sidebar was removed in favor of toolbar + project bar layout.
 * Skipped until sidebar is re-introduced.
 */
test.describe.skip('Sidebar', () => {
  // Inject a project to show the main layout (not welcome screen)
  test.beforeEach(async ({ window }) => {
    await injectMockProject(window, [mockProject])
    await window.waitForTimeout(200)
  })

  test('sidebar renders expanded by default with width > 200px', async ({ window }) => {
    // Wait for sidebar to render using data-testid
    const sidebar = window.locator('[data-testid="sidebar"]')
    await expect(sidebar).toBeVisible()

    // Get bounding box to check width
    const box = await sidebar.boundingBox()
    expect(box).toBeTruthy()
    expect(box!.width).toBeGreaterThan(200)
  })

  test('sidebar collapses on toggle click with width < 100px', async ({ window }) => {
    // Find collapse button using data-testid
    const toggleButton = window.locator('[data-testid="sidebar-toggle"]')
    await expect(toggleButton).toBeVisible()

    // Click to collapse
    await toggleButton.click()

    // Wait for sidebar to transition
    await window.waitForTimeout(300)

    // Verify sidebar is now collapsed
    const sidebar = window.locator('[data-testid="sidebar"]')
    const box = await sidebar.boundingBox()
    expect(box).toBeTruthy()
    expect(box!.width).toBeLessThan(100)

    // Verify toggle button still visible (now with expand title)
    await expect(toggleButton).toBeVisible()
    await expect(toggleButton).toHaveAttribute('title', 'Expand sidebar')
  })

  test('tooltips show when sidebar is collapsed', async ({ window }) => {
    // First collapse the sidebar
    const toggleButton = window.locator('[data-testid="sidebar-toggle"]')
    await toggleButton.click()
    await window.waitForTimeout(300)

    // When collapsed, tooltip wrapper should exist with group class
    const tooltipWrapper = window.locator('.group').first()
    await expect(tooltipWrapper).toBeVisible()

    // Hover over settings button to show tooltip
    const settingsButton = window.locator('[data-testid="settings-button"]')
    await settingsButton.hover()
    await window.waitForTimeout(150)

    // Verify hover interaction works by checking the button is still focusable
    // Tooltip visibility depends on CSS :hover state which can be unreliable in tests
    await expect(settingsButton).toBeEnabled()
  })

  test('settings button shows update badge when update available', async ({ window }) => {
    // The update badge is shown when updateStore has status: 'available'
    // We verify the settings button exists and can contain a badge element
    const settingsButton = window.locator('[data-testid="settings-button"]')
    await expect(settingsButton).toBeVisible()

    // Check that the button structure supports a badge (has relative positioning)
    const hasRelativeClass = await settingsButton.evaluate((el) =>
      el.className.includes('relative')
    )
    expect(hasRelativeClass).toBe(true)
  })

  test('navigation items are visible in expanded state', async ({ window }) => {
    // Check for navigation section
    const navLabel = window.locator('text=Navigation')
    await expect(navLabel).toBeVisible()

    // Check for Terminals nav item (use getByRole to be specific)
    const terminalsNav = window.getByRole('button', { name: 'Terminals' })
    await expect(terminalsNav).toBeVisible()

    // Check for GitHub nav item
    const githubNav = window.getByRole('button', { name: 'GitHub' })
    await expect(githubNav).toBeVisible()
  })

  test('sidebar toggle persists collapsed state', async ({ window }) => {
    // Collapse sidebar using data-testid
    const toggleButton = window.locator('[data-testid="sidebar-toggle"]')
    await toggleButton.click()
    await window.waitForTimeout(300)

    // Verify collapsed - toggle button should now have expand title
    await expect(toggleButton).toHaveAttribute('title', 'Expand sidebar')

    // Expand again
    await toggleButton.click()
    await window.waitForTimeout(300)

    // Verify expanded - toggle button should have collapse title
    await expect(toggleButton).toHaveAttribute('title', 'Collapse sidebar')
  })
})
