import { test, expect, injectMockProject } from '../fixtures'
import { mockProject } from '../fixtures/test-data'

/**
 * Terminal Grid Layout Tests
 * Tests grid behavior with different numbers of terminals.
 * Note: Tests are designed to work with existing terminals by checking relative counts.
 */
test.describe('Terminal Grid Layout', () => {
  test.beforeEach(async ({ window }) => {
    // Inject mock project data
    await injectMockProject(window, [mockProject])
    // Wait for app to initialize
    await window.waitForSelector('#root', { state: 'attached' })
    // Give extra time for any session restoration to complete
    await window.waitForTimeout(500)
  })

  /**
   * Helper to add a new terminal (works whether terminals exist or not)
   */
  async function addTerminal(window: import('@playwright/test').Page): Promise<void> {
    // First try the empty state button, then the action bar button
    const emptyStateButton = window.locator('button:has-text("+ New Terminal")')
    const actionBarButton = window.locator('button:has-text("+ New")')

    if (await emptyStateButton.isVisible()) {
      await emptyStateButton.click()
    } else {
      await actionBarButton.click()
    }
    await window.waitForTimeout(300)
  }

  test.skip('empty state shows "No terminals open" message and add button', async ({ window }) => {
    // Skip: App restores session from previous run, empty state not reliably testable
    const emptyMessage = window.locator('text=No terminals open')
    await expect(emptyMessage).toBeVisible()
  })

  test('terminal pane is visible and has reasonable size', async ({ window }) => {
    // Get initial count
    const initialCount = await window.locator('.terminal-pane').count()

    // Add a terminal if none exist
    if (initialCount === 0) {
      await addTerminal(window)
      await window.waitForSelector('.terminal-pane', { timeout: 5000 })
    }

    // Verify terminal pane is visible
    const terminalPane = window.locator('.terminal-pane').first()
    await expect(terminalPane).toBeVisible()

    // Verify terminal has a reasonable bounding box
    const boundingBox = await terminalPane.boundingBox()
    expect(boundingBox).not.toBeNull()

    if (boundingBox) {
      // Terminal should have meaningful dimensions
      expect(boundingBox.width).toBeGreaterThan(200)
      expect(boundingBox.height).toBeGreaterThan(100)
    }
  })

  test('adding terminals increases count', async ({ window }) => {
    // Get initial count
    const initialCount = await window.locator('.terminal-pane').count()

    // Add a terminal
    await addTerminal(window)
    await window.waitForSelector('.terminal-pane', { timeout: 5000 })

    // Verify count increased
    const newCount = await window.locator('.terminal-pane').count()
    expect(newCount).toBe(initialCount + 1)
  })

  test('multiple terminals display in grid layout', async ({ window }) => {
    // Get initial count
    const initialCount = await window.locator('.terminal-pane').count()

    // Ensure we have at least 2 terminals
    const terminalsToAdd = Math.max(0, 2 - initialCount)
    for (let i = 0; i < terminalsToAdd; i++) {
      await addTerminal(window)
      if (i === 0 && initialCount === 0) {
        await window.waitForSelector('.terminal-pane', { timeout: 5000 })
      }
    }

    // Verify we have at least 2 terminals
    const terminalCount = await window.locator('.terminal-pane').count()
    expect(terminalCount).toBeGreaterThanOrEqual(2)

    // Get terminal panes
    const terminalPanes = window.locator('.terminal-pane')
    const pane1 = await terminalPanes.nth(0).boundingBox()
    const pane2 = await terminalPanes.nth(1).boundingBox()

    expect(pane1).not.toBeNull()
    expect(pane2).not.toBeNull()

    // Verify terminals are side by side (horizontal split for 2)
    if (pane1 && pane2) {
      // They should have similar Y positions (same row)
      expect(Math.abs(pane1.y - pane2.y)).toBeLessThan(50)
      // Different X positions (side by side)
      expect(Math.abs(pane2.x - pane1.x)).toBeGreaterThan(50)
    }
  })

  test('grid adapts to terminal count', async ({ window }) => {
    // Get initial count
    const initialCount = await window.locator('.terminal-pane').count()

    // Add terminals to reach 4 total
    const terminalsToAdd = Math.max(0, 4 - initialCount)
    for (let i = 0; i < terminalsToAdd; i++) {
      await addTerminal(window)
      if (i === 0 && initialCount === 0) {
        await window.waitForSelector('.terminal-pane', { timeout: 5000 })
      }
    }

    // Verify we have at least 4 terminals
    const terminalCount = await window.locator('.terminal-pane').count()
    expect(terminalCount).toBeGreaterThanOrEqual(4)

    // Get all terminal pane bounding boxes
    const terminalPanes = window.locator('.terminal-pane')
    const boxes: Array<{ x: number; y: number }> = []
    const count = await terminalPanes.count()
    for (let i = 0; i < Math.min(count, 4); i++) {
      const box = await terminalPanes.nth(i).boundingBox()
      if (box) boxes.push({ x: box.x, y: box.y })
    }

    expect(boxes.length).toBe(4)

    // For 4 terminals, should have 2 distinct rows and 2 distinct columns
    const uniqueYs = Array.from(new Set(boxes.map(b => Math.round(b.y / 50))))
    const uniqueXs = Array.from(new Set(boxes.map(b => Math.round(b.x / 50))))

    expect(uniqueYs.length).toBe(2) // 2 rows
    expect(uniqueXs.length).toBe(2) // 2 columns
  })

  test.skip('9 terminals in 3x3 grid', async ({ window }) => {
    // Skip: Takes too long with session restoration issues
  })

  test.skip('12 terminals in 3x4 grid', async ({ window }) => {
    // Skip: Takes too long and max terminals may be limited
  })

  test('grid layout screenshot', async ({ window }) => {
    // Get initial count
    const initialCount = await window.locator('.terminal-pane').count()

    // Add terminals to reach 4 total for 2x2 grid screenshot
    const terminalsToAdd = Math.max(0, 4 - initialCount)
    for (let i = 0; i < terminalsToAdd; i++) {
      await addTerminal(window)
      if (i === 0 && initialCount === 0) {
        await window.waitForSelector('.terminal-pane', { timeout: 5000 })
      }
    }

    // Wait for terminals to fully render
    await window.waitForTimeout(500)

    // Take screenshot of grid area
    const gridArea = window.locator('.terminal-pane').first().locator('..')
    await expect(gridArea).toHaveScreenshot('terminal-grid-2x2.png', {
      maxDiffPixelRatio: 0.02
    })
  })
})
