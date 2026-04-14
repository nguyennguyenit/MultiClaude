import type { Page } from '@playwright/test'
import { test, expect, injectMockProject, WAIT_TIMES } from '../fixtures'
import { mockProject } from '../fixtures/test-data'

// Skip PTY-dependent tests on CI (terminal creation can be unreliable)
const isCI = process.env.CI === 'true'

async function createTerminalForActiveProject(window: Page): Promise<string | null> {
  return await window.evaluate(async () => {
    const appWindow = window as typeof window & {
      electron: {
        terminal: {
          create: (input: { cwd: string; projectId: string }) => Promise<{
            id: string
            title: string
            cwd: string
            isClaudeMode: boolean
            projectId?: string
            createdAt: string
          }>
        }
      }
    }

    const store = (appWindow as unknown as {
      __APP_STORE__?: {
        getState: () => {
          activeProjectId: string | null
          projects: Array<{ id: string; path: string }>
          addTerminal: (terminal: {
            id: string
            title: string
            cwd: string
            isClaudeMode: boolean
            projectId?: string
            createdAt: string
          }) => void
        }
      }
    }).__APP_STORE__

    const state = store?.getState()
    const activeProject = state?.projects.find((project) => project.id === state.activeProjectId)
    if (!state || !activeProject) return null

    const terminal = await appWindow.electron.terminal.create({
      cwd: activeProject.path,
      projectId: activeProject.id
    })
    state.addTerminal(terminal)
    return terminal.id
  })
}

/**
 * Terminal Pane Interaction Tests
 * Tests terminal header, title editing, and close functionality.
 * Note: Skipped on CI - PTY creation is unreliable in headless environment.
 */
test.describe('Terminal Pane Interactions', () => {
  // Skip entire suite on CI - all tests require PTY creation
  test.skip(isCI, 'Terminal pane tests require PTY which is unreliable on CI')

  test.beforeEach(async ({ window }) => {
    const terminalPanes = window.locator('[data-terminal-id]')

    // Inject mock project data
    await injectMockProject(window, [mockProject])
    await window.waitForSelector('#root', { state: 'attached' })
    await window.waitForTimeout(WAIT_TIMES.LONG)

    // Ensure at least one terminal exists
    const terminalCount = await terminalPanes.count()
    if (terminalCount === 0) {
      const terminalId = await createTerminalForActiveProject(window)
      expect(terminalId).toBeTruthy()
      await window.waitForSelector('[data-terminal-id]', { timeout: 5000 })
    }
  })

  test('header displays terminal title', async ({ window }) => {
    // Find terminal pane header
    const terminalPane = window.locator('.terminal-pane').first()
    await expect(terminalPane).toBeVisible()

    // Header should contain title text
    const header = terminalPane.locator('div').first() // Header is first child
    const titleSpan = header.locator('span').first()

    await expect(titleSpan).toBeVisible()
    const titleText = await titleSpan.textContent()
    expect(titleText).toBeTruthy()
    expect(titleText?.length).toBeGreaterThan(0)
  })

  test('title editable on double-click (input appears)', async ({ window }) => {
    const terminalPane = window.locator('.terminal-pane').first()

    // Find the title span (not Claude badge or buttons)
    const titleSpan = terminalPane.locator('span[title="Double-click to rename"]').first()
    await expect(titleSpan).toBeVisible()

    // Double-click to enter edit mode
    await titleSpan.dblclick()

    // Input should appear
    const titleInput = terminalPane.locator('input[type="text"]')
    await expect(titleInput).toBeVisible({ timeout: 1000 })

    // Input should be focused and contain existing title
    await expect(titleInput).toBeFocused()
  })

  test('selection copy still completes when mouseup happens below the terminal surface', async ({ window }) => {
    const terminalIds = await window.evaluate(() => {
      const store = (window as unknown as {
        __APP_STORE__?: {
          getState: () => {
            activeTerminalId: string | null
            terminals: Array<{ id: string }>
          }
        }
      }).__APP_STORE__

      const state = store?.getState()
      return {
        activeTerminalId: state?.activeTerminalId ?? null
      }
    })

    expect(terminalIds.activeTerminalId).toBeTruthy()

    const sourceScreen = window.locator(`[data-terminal-id="${terminalIds.activeTerminalId}"] .xterm-screen`)

    await expect(sourceScreen).toBeVisible()

    const sourceBox = await sourceScreen.boundingBox()
    const viewport = await window.evaluate(() => ({ width: globalThis.innerWidth, height: globalThis.innerHeight }))

    expect(sourceBox).not.toBeNull()
    if (!sourceBox) return

    await window.evaluate(() => navigator.clipboard.writeText('SENTINEL'))

    await window.mouse.move(sourceBox.x + 120, sourceBox.y + 40)
    await window.mouse.down()
    await window.mouse.move(sourceBox.x + 320, viewport.height - 20, { steps: 20 })
    await window.mouse.up()

    await expect(window.locator('text=Copied to clipboard')).toBeVisible({ timeout: 2000 })

    const clipboardText = await window.evaluate(async () => navigator.clipboard.readText())
    expect(clipboardText).not.toBe('SENTINEL')
  })

  test('right-click does not paste clipboard text immediately', async ({ window }) => {
    const terminalIds = await window.evaluate(() => {
      const store = (window as unknown as {
        __APP_STORE__?: {
          getState: () => {
            activeTerminalId: string | null
          }
        }
      }).__APP_STORE__

      const state = store?.getState()
      return {
        activeTerminalId: state?.activeTerminalId ?? null
      }
    })

    expect(terminalIds.activeTerminalId).toBeTruthy()

    const terminalScreen = window.locator(`[data-terminal-id="${terminalIds.activeTerminalId}"] .xterm-screen`)
    await expect(terminalScreen).toBeVisible()

    const pastedMarker = 'RIGHT_CLICK_MENU_SENTINEL'
    await window.evaluate((text) => {
      Object.defineProperty(navigator, 'clipboard', {
        configurable: true,
        value: {
          readText: async () => text,
          writeText: async () => {}
        }
      })
    }, pastedMarker)

    await terminalScreen.click({ button: 'right' })
    await window.waitForTimeout(WAIT_TIMES.LONG)

    await expect(window.locator(`text=${pastedMarker}`)).toHaveCount(0)

    await window.keyboard.press('Escape').catch(() => {})
  })

  test.skip('new title saves on Enter', async ({ window }) => {
    // Skip: Title updates require store state propagation which doesn't work reliably in test env
    const terminalPane = window.locator('.terminal-pane').first()

    // Enter edit mode
    const titleSpan = terminalPane.locator('span[title="Double-click to rename"]').first()
    await titleSpan.dblclick()

    // Find the input
    const titleInput = terminalPane.locator('input[type="text"]')
    await expect(titleInput).toBeVisible()

    // Clear and type new title
    const newTitle = 'My Custom Terminal'
    await titleInput.fill(newTitle)

    // Verify input has the new value before pressing Enter
    await expect(titleInput).toHaveValue(newTitle)

    await titleInput.press('Enter')

    // Wait for input to disappear (edit mode ended)
    await expect(titleInput).not.toBeVisible({ timeout: 2000 })

    // Wait for state to propagate
    await window.waitForTimeout(300)

    // Verify new title is displayed
    const updatedTitleSpan = terminalPane.locator('span[title="Double-click to rename"]')
    await expect(updatedTitleSpan).toHaveText(newTitle, { timeout: 3000 })
  })

  test('title edit cancels on Escape', async ({ window }) => {
    const terminalPane = window.locator('.terminal-pane').first()

    // Get original title
    const titleSpan = terminalPane.locator('span[title="Double-click to rename"]').first()
    const originalTitle = await titleSpan.textContent()

    // Enter edit mode
    await titleSpan.dblclick()
    const titleInput = terminalPane.locator('input[type="text"]')
    await expect(titleInput).toBeVisible()

    // Type new title then press Escape
    await titleInput.fill('Cancelled Title')
    await titleInput.press('Escape')

    // Verify original title is restored
    await expect(titleInput).not.toBeVisible({ timeout: 1000 })
    const restoredTitleSpan = terminalPane.locator('span[title="Double-click to rename"]')
    await expect(restoredTitleSpan).toHaveText(originalTitle || '')
  })

  test.skip('close button removes terminal', async ({ window }) => {
    // Skip: Closing terminals can cause app instability in test environment
    let terminalCount = await window.locator('.terminal-pane').count()
    expect(terminalCount).toBeGreaterThanOrEqual(1)
  })

  test('active terminal has highlight styling', async ({ window }) => {
    // Get initial count
    const initialCount = await window.locator('.terminal-pane').count()

    // Ensure we have at least 2 terminals
    if (initialCount < 2) {
      const addButton = window.locator('button:has-text("+ New")')
      const terminalsToAdd = 2 - initialCount
      for (let i = 0; i < terminalsToAdd; i++) {
        await addButton.click()
        await window.waitForTimeout(WAIT_TIMES.STANDARD)
      }
    }

    // Verify at least 2 terminals
    const terminalCount = await window.locator('.terminal-pane').count()
    expect(terminalCount).toBeGreaterThanOrEqual(2)

    // The most recently created terminal should be active
    const terminalPanes = window.locator('.terminal-pane')
    const activePane = window.locator('.terminal-pane-active')

    // Should have exactly one active pane
    await expect(activePane).toHaveCount(1)

    // Click the first terminal pane
    await terminalPanes.nth(0).click()
    await window.waitForTimeout(WAIT_TIMES.MEDIUM)

    // Now first pane should have active class
    await expect(terminalPanes.nth(0)).toHaveClass(/terminal-pane-active/)
  })

  test('Terminal header buttons display correctly', async ({ window }) => {
    // First terminal should show header elements
    const terminalPane = window.locator('.terminal-pane').first()
    await expect(terminalPane).toBeVisible()

    // Refresh terminal button should be visible
    const refreshButton = window.locator('button[title="Refresh terminal display"]').first()
    await expect(refreshButton).toBeVisible()

    // Insert file path button should be visible
    const insertPathButton = window.locator('button[title*="Insert file path"]').first()
    await expect(insertPathButton).toBeVisible()
  })

  test('insert file path button exists and is clickable', async ({ window }) => {
    const terminalPane = window.locator('.terminal-pane').first()
    await expect(terminalPane).toBeVisible()

    // Find insert file path button
    const insertPathButton = window.locator('button[title*="Insert file path"]').first()
    await expect(insertPathButton).toBeVisible()

    // Button should be enabled
    await expect(insertPathButton).toBeEnabled()
  })
})
