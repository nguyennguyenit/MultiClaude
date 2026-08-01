/**
 * Responsive Layout E2E Tests
 *
 * Parameterized tests validating layout behavior across multiple viewport sizes.
 * Tests project-toolbar visibility, terminal grid sizing, and component responsiveness.
 */
import { test, expect, injectMockProject } from '../fixtures'
import { mockProject, mockProjects, viewportSizes } from '../fixtures/test-data'

/**
 * Helper to check if viewport has horizontal scrollbar.
 */
async function hasHorizontalScrollbar(window: import('@playwright/test').Page): Promise<boolean> {
  return await window.evaluate(() =>
    document.documentElement.scrollWidth > document.documentElement.clientWidth
  )
}

/**
 * Helper to get element dimensions via bounding box.
 */
async function getElementDimensions(
  element: import('@playwright/test').Locator
): Promise<{ width: number; height: number } | null> {
  const box = await element.boundingBox()
  if (!box) return null
  return { width: box.width, height: box.height }
}

// Parameterized tests for each viewport size
for (const viewport of viewportSizes) {
  test.describe(`Responsive Layout @ ${viewport.name} (${viewport.width}x${viewport.height})`, () => {
    test.beforeEach(async ({ window }) => {
      // Set viewport size before each test
      await window.setViewportSize({ width: viewport.width, height: viewport.height })
      // Allow layout to settle
      await window.waitForTimeout(100)
    })

    test('full app layout fits viewport without horizontal scrollbar', async ({ window }) => {
      // Inject project to show main layout (not welcome screen)
      await injectMockProject(window, [mockProject])
      await window.waitForTimeout(200)

      // Check for horizontal scrollbar
      const hasScroll = await hasHorizontalScrollbar(window)
      expect(hasScroll).toBe(false)

      // Verify body width matches viewport
      const bodyWidth = await window.evaluate(() => document.body.clientWidth)
      expect(bodyWidth).toBeLessThanOrEqual(viewport.width)
    })

    test('project toolbar is visible and functional', async ({ window }) => {
      await injectMockProject(window, [mockProject])
      await window.waitForTimeout(200)

      const toolbar = window.locator('.toolbar')
      await expect(toolbar).toBeVisible()
      await expect(window.locator('[data-testid="project-tabs-container"]')).toBeVisible()
      await expect(window.locator('[data-testid="settings-button"]')).toBeVisible()

      const dims = await getElementDimensions(toolbar)
      expect(dims).not.toBeNull()
      expect(dims!.width).toBeGreaterThan(0)
      expect(dims!.width).toBeLessThanOrEqual(viewport.width)
    })

    test('terminal grid uses adequate space (>40% of viewport)', async ({ window }) => {
      await injectMockProject(window, [mockProject])
      await window.waitForTimeout(500) // Allow terminal grid to render

      // Find terminal grid container using data-testid
      const terminalArea = window.locator('[data-testid="terminal-area"]')
      await expect(terminalArea).toBeVisible()

      const dims = await getElementDimensions(terminalArea)
      expect(dims).not.toBeNull()

      // Terminal area should use at least 40% of viewport height
      const minHeight = viewport.height * 0.4
      expect(dims!.height).toBeGreaterThanOrEqual(minHeight)

      // Terminal area should fill most of remaining width after sidebar
      const minWidth = viewport.width * 0.5 // At least half viewport width
      expect(dims!.width).toBeGreaterThanOrEqual(minWidth)
    })

    test('settings modal fits within viewport', async ({ window }) => {
      await injectMockProject(window, [mockProject])
      await window.waitForTimeout(200)

      // Find and click settings button using data-testid
      const settingsButton = window.locator('[data-testid="settings-button"]')
      await settingsButton.click()
      await window.waitForTimeout(200)

      // Find settings modal using data-testid
      const modal = window.locator('[data-testid="settings-modal"]')
      await expect(modal).toBeVisible()

      const modalDims = await getElementDimensions(modal)
      expect(modalDims).not.toBeNull()

      // Modal should fit within viewport bounds
      expect(modalDims!.width).toBeLessThanOrEqual(viewport.width)
      expect(modalDims!.height).toBeLessThanOrEqual(viewport.height)

      // Close modal with Escape
      await window.keyboard.press('Escape')
    })

    test('project tabs handle overflow at narrow widths', async ({ window }) => {
      // Inject multiple projects to test overflow
      await injectMockProject(window, mockProjects)
      await window.waitForTimeout(200)

      // Find project tabs container using data-testid
      const tabsContainer = window.locator('[data-testid="project-tabs-container"]')

      // At narrow widths with many projects, tabs should handle overflow
      if (viewport.width < 1024) {
        // Either scrollable or truncated - just verify no horizontal page scroll
        const hasPageScroll = await hasHorizontalScrollbar(window)
        expect(hasPageScroll).toBe(false)
      }

      // Verify tabs container exists and is visible
      await expect(tabsContainer).toBeVisible()
    })

    test('takes layout screenshot for visual regression', async ({ window }) => {
      await injectMockProject(window, [mockProject])
      await window.waitForTimeout(500)

      await expect(window).toHaveScreenshot(`responsive-layout-${viewport.name}.png`, {
        animations: 'disabled',
        fullPage: true,
        maxDiffPixelRatio: 0.015
      })
    })
  })
}

/**
 * Layout Consistency Tests
 *
 * Verifies layout elements maintain proper proportions across sizes.
 */
test.describe('Layout Consistency', () => {
  test('title bar height is consistent across viewports', async ({ window }) => {
    const titleBarHeights: number[] = []

    for (const viewport of viewportSizes.slice(0, 3)) { // Test first 3 sizes
      await window.setViewportSize({ width: viewport.width, height: viewport.height })
      await window.waitForTimeout(100)

      const titleBar = window.locator('.toolbar')
      const dims = await getElementDimensions(titleBar)
      if (dims) {
        titleBarHeights.push(dims.height)
      }
    }

    // All title bar heights should be the same (40px as per App.tsx)
    expect(titleBarHeights).toHaveLength(3)
    const firstHeight = titleBarHeights[0]
    for (const height of titleBarHeights) {
      expect(height).toBe(firstHeight)
    }
  })

  test('viewport resize triggers layout adjustment', async ({ window }) => {
    await injectMockProject(window, [mockProject])

    // Start at large viewport
    await window.setViewportSize({ width: 1920, height: 1080 })
    await window.waitForTimeout(200)

    // Resize to small viewport
    await window.setViewportSize({ width: 800, height: 600 })
    await window.waitForTimeout(300)

    // Layout should have adjusted - no horizontal scroll
    const hasScroll = await hasHorizontalScrollbar(window)
    expect(hasScroll).toBe(false)

    // Resize back to large
    await window.setViewportSize({ width: 1920, height: 1080 })
    await window.waitForTimeout(300)

    const toolbarWidth = (await getElementDimensions(window.locator('.toolbar')))?.width ?? 0
    expect(toolbarWidth).toBeGreaterThan(0)
    expect(toolbarWidth).toBeLessThanOrEqual(1920)
  })
})

/**
 * Visual Regression Tests
 *
 * Screenshot-based tests for layout consistency.
 */
test.describe('Visual Regression', () => {
  test('welcome screen layout at FHD', async ({ window }) => {
    await window.setViewportSize({ width: 1920, height: 1080 })
    await window.waitForTimeout(300)

    await expect(window.getByRole('heading', { name: 'MultiClaude' })).toBeVisible()
    await expect(window).toHaveScreenshot('responsive-welcome-fhd.png', {
      animations: 'disabled',
      fullPage: true,
      maxDiffPixelRatio: 0.015
    })
  })

  test('welcome screen layout at laptop size', async ({ window }) => {
    await window.setViewportSize({ width: 1366, height: 768 })
    await window.waitForTimeout(300)

    await expect(window.getByRole('heading', { name: 'MultiClaude' })).toBeVisible()
    await expect(window).toHaveScreenshot('responsive-welcome-laptop.png', {
      animations: 'disabled',
      fullPage: true,
      maxDiffPixelRatio: 0.015
    })
  })
})
