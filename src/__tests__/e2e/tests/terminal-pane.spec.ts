import type { Page } from '@playwright/test'
import { test, expect, injectMockProject, addTerminal, WAIT_TIMES } from '../fixtures'
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
    const terminalPane = window.locator('[data-terminal-id]').first()
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
    const terminalPane = window.locator('[data-terminal-id]').first()

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

    const snapshot = await window.evaluate(
      async (terminalId) => globalThis.window.electron.terminal.getSnapshot(terminalId),
      terminalIds.activeTerminalId!
    )
    expect(snapshot.ansi).not.toContain(pastedMarker)

    await window.keyboard.press('Escape').catch(() => {})
  })
  test('title edit cancels on Escape', async ({ window }) => {
    const terminalPane = window.locator('[data-terminal-id]').first()

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

  test('close button removes terminal', async ({ window }) => {
    const terminals = window.locator('[data-terminal-id]')
    const initialCount = await terminals.count()
    expect(initialCount).toBeGreaterThanOrEqual(1)

    await terminals.first().getByRole('button', { name: 'Close terminal' }).click()
    await expect(terminals).toHaveCount(initialCount - 1)
  })

  test('active terminal has highlight styling', async ({ window }) => {
    // Get initial count
    const initialCount = await window.locator('[data-terminal-id]').count()

    // Ensure we have at least 2 terminals
    if (initialCount < 2) {
      const terminalsToAdd = 2 - initialCount
      for (let i = 0; i < terminalsToAdd; i++) {
        await addTerminal(window)
      }
    }

    // Verify at least 2 terminals
    const terminalCount = await window.locator('[data-terminal-id]').count()
    expect(terminalCount).toBeGreaterThanOrEqual(2)

    // The most recently created terminal should be active
    const terminalPanes = window.locator('[data-terminal-id]')
    const activePane = window.locator('.terminal-cell-overlay.active [data-terminal-id]')

    // Should have exactly one active pane
    await expect(activePane).toHaveCount(1)

    // Click the first terminal pane
    await terminalPanes.nth(0).click()
    await window.waitForTimeout(WAIT_TIMES.MEDIUM)

    // The overlay that owns the first terminal should now be active.
    await expect(terminalPanes.nth(0).locator('xpath=ancestor::div[contains(@class,"terminal-cell-overlay")]')).toHaveClass(/active/)
  })

  test('Terminal header buttons display correctly', async ({ window }) => {
    // First terminal should show header elements
    const terminalPane = window.locator('[data-terminal-id]').first()
    await expect(terminalPane).toBeVisible()

    // Refresh terminal button should be visible
    const refreshButton = window.locator('button[title="Refresh terminal display"]').first()
    await expect(refreshButton).toBeVisible()

    // Insert file path button should be visible
    const insertPathButton = window.locator('button[title*="Insert file path"]').first()
    await expect(insertPathButton).toBeVisible()
  })

  test('insert file path button exists and is clickable', async ({ window }) => {
    const terminalPane = window.locator('[data-terminal-id]').first()
    await expect(terminalPane).toBeVisible()

    // Find insert file path button
    const insertPathButton = window.locator('button[title*="Insert file path"]').first()
    await expect(insertPathButton).toBeVisible()

    // Button should be enabled
    await expect(insertPathButton).toBeEnabled()
  })
})
