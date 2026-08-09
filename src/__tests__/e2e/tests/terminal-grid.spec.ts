import { test, expect, injectMockProject, addTerminal, clearAllTerminalsForScreenshot, WAIT_TIMES } from '../fixtures'
import {
  activateTerminalPane,
  openRendererDiagnostics,
  readVisibleRendererStatus,
} from '../fixtures/electron-app'
import { mockProject } from '../fixtures/test-data'

// Skip PTY-dependent tests on CI (terminal creation can be unreliable)
const isCI = process.env.CI === 'true'

/**
 * Terminal Grid Layout Tests
 * Tests grid behavior with different numbers of terminals.
 * Note: Skipped on CI - PTY creation is unreliable in headless environment.
 */
test.describe('Terminal Grid Layout', () => {
  // Skip entire suite on CI - all tests require PTY creation
  test.skip(isCI, 'Terminal grid tests require PTY which is unreliable on CI')

  test.beforeEach(async ({ window }) => {
    // Inject mock project data
    await injectMockProject(window, [mockProject])
    // Wait for app to initialize
    await window.waitForSelector('#root', { state: 'attached' })
    // Give extra time for any session restoration to complete
    await window.waitForTimeout(WAIT_TIMES.LONG)
  })

  test('empty state explains how to create the first terminal', async ({ window }) => {
    await expect(window.getByRole('heading', { name: 'Multi Terminals' })).toBeVisible()
    await expect(window.getByRole('button', { name: '+ New Terminal' })).toBeVisible()
  })

  test('terminal pane is visible and has reasonable size', async ({ window }) => {
    // Get initial count
    const initialCount = await window.locator('[data-terminal-id]').count()

    // Add a terminal if none exist
    if (initialCount === 0) {
      await addTerminal(window)
      await window.waitForSelector('[data-terminal-id]', { timeout: 5000 })
    }

    // Verify terminal pane is visible
    const terminalPane = window.locator('[data-terminal-id]').first()
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
    const initialCount = await window.locator('[data-terminal-id]').count()

    // Add a terminal
    await addTerminal(window)
    await window.waitForSelector('[data-terminal-id]', { timeout: 5000 })

    // Verify count increased
    const newCount = await window.locator('[data-terminal-id]').count()
    expect(newCount).toBe(initialCount + 1)
  })

  test('multiple terminals display in grid layout', async ({ window }) => {
    // Get initial count
    const initialCount = await window.locator('[data-terminal-id]').count()

    // Ensure we have at least 2 terminals
    const terminalsToAdd = Math.max(0, 2 - initialCount)
    for (let i = 0; i < terminalsToAdd; i++) {
      await addTerminal(window)
      if (i === 0 && initialCount === 0) {
        await window.waitForSelector('[data-terminal-id]', { timeout: 5000 })
      }
    }

    // Verify we have at least 2 terminals
    const terminalCount = await window.locator('[data-terminal-id]').count()
    expect(terminalCount).toBeGreaterThanOrEqual(2)

    // Get terminal panes
    const terminalPanes = window.locator('[data-terminal-id]')
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
    const initialCount = await window.locator('[data-terminal-id]').count()

    // Add terminals to reach 4 total
    const terminalsToAdd = Math.max(0, 4 - initialCount)
    for (let i = 0; i < terminalsToAdd; i++) {
      await addTerminal(window)
      if (i === 0 && initialCount === 0) {
        await window.waitForSelector('[data-terminal-id]', { timeout: 5000 })
      }
    }

    // Verify we have at least 4 terminals
    const terminalCount = await window.locator('[data-terminal-id]').count()
    expect(terminalCount).toBeGreaterThanOrEqual(4)

    // Get all terminal pane bounding boxes
    const terminalPanes = window.locator('[data-terminal-id]')
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

  test('9 terminals form a usable 3x3 grid', async ({ window }) => {
    test.setTimeout(60_000)

    const initialCount = await window.locator('[data-terminal-id]').count()
    for (let i = initialCount; i < 9; i++) {
      await addTerminal(window)
    }

    const terminals = window.locator('[data-terminal-id]')
    await expect(terminals).toHaveCount(9)

    const boxes = await terminals.evaluateAll((panes) =>
      panes.map((pane) => {
        const rect = pane.getBoundingClientRect()
        return {
          x: Math.round(rect.x),
          y: Math.round(rect.y),
          width: rect.width,
          height: rect.height
        }
      })
    )

    expect(boxes.every(({ width, height }) => width > 200 && height > 100)).toBe(true)
    expect(new Set(boxes.map(({ x }) => x)).size).toBe(3)
    expect(new Set(boxes.map(({ y }) => y)).size).toBe(3)
  })

  test('1/4/9 activated panes expose stable typed Automatic renderer status', async ({ window }) => {
    test.setTimeout(90_000)

    for (const targetCount of [1, 4, 9]) {
      const panes = window.locator('[data-terminal-id]')
      while (await panes.count() < targetCount) await addTerminal(window)
      await expect(panes).toHaveCount(targetCount)

      const terminalIds = await panes.evaluateAll(elements =>
        elements.map(element => element.getAttribute('data-terminal-id')).filter((id): id is string => Boolean(id))
      )
      expect(terminalIds).toHaveLength(targetCount)
      for (const terminalId of terminalIds) await activateTerminalPane(window, terminalId)

      await openRendererDiagnostics(window)
      await expect(window.getByRole('radio', { name: 'Automatic (Recommended)', exact: true })).toBeChecked()

      for (const terminalId of terminalIds) {
        await expect.poll(async () =>
          (await readVisibleRendererStatus(window, terminalId)).effective
        ).toMatch(/^(WebGL|DOM)$/)
        const status = await readVisibleRendererStatus(window, terminalId)
        expect([
          'none',
          'WebGL is unavailable in this environment.',
          'WebGL could not start.',
          'WebGL context lost.',
        ]).toContain(status.fallback)
        expect(status.retryVisible).toBe(
          status.fallback === 'WebGL could not start.' || status.fallback === 'WebGL context lost.'
        )
      }

      await window.getByRole('button', { name: 'Close Settings' }).click()
      await expect(window.getByTestId('settings-modal')).not.toBeVisible()
    }
  })

  test('grid layout screenshot', async ({ window }) => {
    // Get initial count
    const initialCount = await window.locator('[data-terminal-id]').count()

    // Add terminals to reach 4 total for 2x2 grid screenshot
    const terminalsToAdd = Math.max(0, 4 - initialCount)
    for (let i = 0; i < terminalsToAdd; i++) {
      await addTerminal(window)
      if (i === 0 && initialCount === 0) {
        await window.waitForSelector('[data-terminal-id]', { timeout: 5000 })
      }
    }

    // Wait for terminals to fully render
    await window.waitForTimeout(WAIT_TIMES.LONG)

    // Clear all terminals and inject fixed prompt for consistent screenshots
    await clearAllTerminalsForScreenshot(window)

    // Take screenshot of grid area
    const gridArea = window.getByRole('region', {
      name: `Terminal grid for project ${mockProject.id}`
    })
    await expect(gridArea).toHaveScreenshot('terminal-grid-2x2.png', {
      maxDiffPixelRatio: 0.02
    })
  })
})
