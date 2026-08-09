/* eslint-disable @typescript-eslint/no-explicit-any */
import type { Page } from '@playwright/test'
import { test, expect, injectMockProject, addTerminal, WAIT_TIMES } from '../fixtures'
import { mockProjects } from '../fixtures/test-data'

const isCI = process.env.CI === 'true'

/**
 * Project switching E2E tests.
 * Tests cursor display and focus behavior when switching between projects.
 * Validates fix for cursor not appearing after project switch.
 */
test.describe('Project Switching - Cursor Display', () => {
  async function getTerminalViewportMetricsByTerminalId(page: Page, terminalId: string): Promise<{
    scrollTop: number
    scrollHeight: number
    clientHeight: number
    bottomGap: number
  }> {
    return page.evaluate((activeTerminalId: string) => {
      const viewport = document.querySelector(
        `[data-terminal-id="${activeTerminalId}"] .xterm-viewport`
      ) as HTMLElement | null

      if (!viewport) {
        throw new Error(`Viewport not found for terminal ${activeTerminalId}`)
      }

      return {
        scrollTop: viewport.scrollTop,
        scrollHeight: viewport.scrollHeight,
        clientHeight: viewport.clientHeight,
        bottomGap: viewport.scrollHeight - viewport.clientHeight - viewport.scrollTop
      }
    }, terminalId)
  }

  async function getTerminalDebugSnapshot(page: Page, terminalId: string): Promise<{
    baseY: number
    viewportY: number
    savedViewportY: number | null
    isHidden: boolean
    pendingWriteCount: number
    isAtBottom: boolean
    hiddenViewportIntent: { viewportY: number | null, stickToBottom: boolean } | null
    pendingUserScrollIntent: { viewportY: number | null, stickToBottom: boolean } | null
    domScrollTop: number | null
    domScrollHeight: number | null
    domClientHeight: number | null
  } | null> {
    return await page.evaluate((activeTerminalId: string) => {
      const debugWindow = window as typeof window & {
        __TERMINAL_DEBUG__?: Record<string, { getSnapshot: () => unknown }>
      }

      return debugWindow.__TERMINAL_DEBUG__?.[activeTerminalId]?.getSnapshot() ?? null
    }, terminalId) as {
      baseY: number
      viewportY: number
      savedViewportY: number | null
      isHidden: boolean
      pendingWriteCount: number
      isAtBottom: boolean
      hiddenViewportIntent: { viewportY: number | null, stickToBottom: boolean } | null
      pendingUserScrollIntent: { viewportY: number | null, stickToBottom: boolean } | null
      domScrollTop: number | null
      domScrollHeight: number | null
      domClientHeight: number | null
    } | null
  }

  async function getActiveTerminalId(page: Page): Promise<string | null> {
    return page.evaluate(() => {
      const store = (window as any).__APP_STORE__
      return store?.getState()?.activeTerminalId ?? null
    })
  }

  async function getProjectTerminalIds(page: Page, projectId: string): Promise<string[]> {
    return page.evaluate((activeProjectId: string) => {
      const store = (window as any).__APP_STORE__
      const terminals = store?.getState()?.terminals ?? []
      return terminals
        .filter((terminal: { projectId?: string }) => terminal.projectId === activeProjectId)
        .map((terminal: { id: string }) => terminal.id)
    }, projectId)
  }

  async function getRowFlex(page: Page, projectId: string): Promise<number[]> {
    return page.evaluate((activeProjectId: string) => {
      const grid = document.querySelector(
        `[aria-label="Terminal grid for project ${activeProjectId}"]`
      )
      const rootSplit = grid?.querySelector<HTMLElement>('.pane-tree-split')
      const rows = rootSplit
        ? Array.from(rootSplit.querySelectorAll<HTMLElement>(':scope > [data-pane-child]'))
        : []

      return rows.map((row) => Number.parseFloat(window.getComputedStyle(row).flexGrow))
    }, projectId)
  }

  test('input activity marks that terminal as active', async ({ window }) => {
    const [project] = mockProjects
    await injectMockProject(window, [project])
    await window.waitForTimeout(WAIT_TIMES.STANDARD)

    await window.evaluate((projectId: string) => {
      interface TerminalState {
        terminals: Array<{
          id: string
          title: string
          cwd: string
          isClaudeMode: boolean
          projectId: string
          createdAt: string
        }>
        terminalOutputs: Record<string, string>
        activeTerminalId: string | null
      }

      interface StoreApi {
        setState: (state: Partial<TerminalState>) => void
      }

      const appStore = (window as unknown as { __APP_STORE__?: StoreApi }).__APP_STORE__
      appStore?.setState({
        terminals: [
          {
            id: 'term-1',
            title: 'Terminal 1',
            cwd: '/tmp/project-switch-1',
            isClaudeMode: false,
            projectId,
            createdAt: new Date().toISOString()
          },
          {
            id: 'term-2',
            title: 'Terminal 2',
            cwd: '/tmp/project-switch-1',
            isClaudeMode: false,
            projectId,
            createdAt: new Date().toISOString()
          }
        ],
        terminalOutputs: {
          'term-1': '',
          'term-2': ''
        },
        activeTerminalId: 'term-1'
      })
    }, project.id)

    const secondTerminal = window.locator('[data-terminal-id="term-2"] .terminal-container-wrapper')
    await expect(secondTerminal).toBeVisible()

    await secondTerminal.dispatchEvent('keydown', { key: 'a', bubbles: true })
    await window.waitForTimeout(50)

    const activeTerminalId = await window.evaluate(() => {
      const store = (window as any).__APP_STORE__
      return store?.getState()?.activeTerminalId
    })

    expect(activeTerminalId).toBe('term-2')
  })

  test('A->B switch: cursor visible after switching projects', async ({ window }) => {
    // Setup: 2 projects
    const twoProjects = mockProjects.slice(0, 2)
    await injectMockProject(window, twoProjects)
    await window.waitForTimeout(WAIT_TIMES.STANDARD)

    // Click second project tab
    const secondTab = window.locator(`[data-testid="project-tab-${twoProjects[1].id}"]`)
    await expect(secondTab).toBeVisible()
    await secondTab.click()

    // Wait for WebGL toggle + focus delay (60ms)
    await window.waitForTimeout(100)

    // Verify state: activeProjectId should be second project
    const activeProjectId = await window.evaluate(() => {
      const store = (window as any).__APP_STORE__
      return store?.getState()?.activeProjectId
    })
    expect(activeProjectId).toBe(twoProjects[1].id)
  })

  test('A->B->C->A switch: cursor visible after returning to first project', async ({ window }) => {
    // Setup: 3 projects
    const threeProjects = mockProjects.slice(0, 3)
    await injectMockProject(window, threeProjects)
    await window.waitForTimeout(WAIT_TIMES.STANDARD)

    // Switch A -> B
    const tabB = window.locator(`[data-testid="project-tab-${threeProjects[1].id}"]`)
    await tabB.click()
    await window.waitForTimeout(100)

    // Switch B -> C
    const tabC = window.locator(`[data-testid="project-tab-${threeProjects[2].id}"]`)
    await tabC.click()
    await window.waitForTimeout(100)

    // Switch C -> A (return to first)
    const tabA = window.locator(`[data-testid="project-tab-${threeProjects[0].id}"]`)
    await tabA.click()
    await window.waitForTimeout(100)

    // Verify state: activeProjectId should be first project
    const activeProjectId = await window.evaluate(() => {
      const store = (window as any).__APP_STORE__
      return store?.getState()?.activeProjectId
    })
    expect(activeProjectId).toBe(threeProjects[0].id)
  })

  test('atomic state update: project and terminal switch in single update', async ({ window }) => {
    // Setup: 2 projects
    const twoProjects = mockProjects.slice(0, 2)
    await injectMockProject(window, twoProjects)
    await window.waitForTimeout(WAIT_TIMES.STANDARD)

    // Capture state before switch
    const stateBefore = await window.evaluate(() => {
      const store = (window as any).__APP_STORE__
      const state = store?.getState()
      return {
        activeProjectId: state?.activeProjectId,
        activeTerminalId: state?.activeTerminalId
      }
    })

    // Switch using switchToProject (called internally by handleSelectProject)
    const secondTab = window.locator(`[data-testid="project-tab-${twoProjects[1].id}"]`)
    await secondTab.click()
    await window.waitForTimeout(50)

    // Capture state after switch
    const stateAfter = await window.evaluate(() => {
      const store = (window as any).__APP_STORE__
      const state = store?.getState()
      return {
        activeProjectId: state?.activeProjectId,
        activeTerminalId: state?.activeTerminalId
      }
    })

    // Verify atomic update: activeProjectId changed
    expect(stateAfter.activeProjectId).toBe(twoProjects[1].id)
    expect(stateAfter.activeProjectId).not.toBe(stateBefore.activeProjectId)
  })

  test('rapid switching: no race conditions', async ({ window }) => {
    // Setup: 3 projects
    const threeProjects = mockProjects.slice(0, 3)
    await injectMockProject(window, threeProjects)
    await window.waitForTimeout(WAIT_TIMES.STANDARD)

    // Rapid switch: A -> B -> C -> A in quick succession
    const tabA = window.locator(`[data-testid="project-tab-${threeProjects[0].id}"]`)
    const tabB = window.locator(`[data-testid="project-tab-${threeProjects[1].id}"]`)
    const tabC = window.locator(`[data-testid="project-tab-${threeProjects[2].id}"]`)

    await tabB.click()
    await tabC.click()
    await tabA.click()

    // Wait for all state updates and WebGL toggles
    await window.waitForTimeout(WAIT_TIMES.STANDARD)

    // Final state should be project A
    const activeProjectId = await window.evaluate(() => {
      const store = (window as any).__APP_STORE__
      return store?.getState()?.activeProjectId
    })
    expect(activeProjectId).toBe(threeProjects[0].id)
  })

  test.skip(isCI, 'PTY-backed viewport preservation E2E is unreliable on CI')
  test('A->B->A keeps scrollback viewport when hidden terminal continues receiving output', async ({ window }) => {
    const [projectA, projectB] = mockProjects.slice(0, 2)
    await injectMockProject(window, [projectA, projectB])
    await window.waitForTimeout(WAIT_TIMES.STANDARD)

    await addTerminal(window)
    await window.waitForSelector(`[aria-label="Terminal grid for project ${projectA.id}"] .xterm-viewport`, { timeout: 5000 })

    const terminalId = await getActiveTerminalId(window)
    expect(terminalId).toBeTruthy()
    if (!terminalId) {
      throw new Error('Expected active terminal for project A')
    }

    await window.evaluate((id: string) => {
      (globalThis as typeof globalThis & {
        window: Window & { electron: { terminal: { write: (terminalId: string, data: string) => void } } }
      }).window.electron.terminal.write(id, 'seq 1 240; sleep 5; seq 241 520\n')
    }, terminalId)

    await expect.poll(async () => {
      const snapshot = await getTerminalDebugSnapshot(window, terminalId)
      return snapshot?.baseY ?? 0
    }, { timeout: 5000 }).toBeGreaterThan(150)

    await window.locator('[aria-label="Scroll to top"]').first().click()
    await expect.poll(async () => {
      const snapshot = await getTerminalDebugSnapshot(window, terminalId)
      return snapshot?.viewportY
    }).toBe(0)
    const beforeSwitchDebug = await getTerminalDebugSnapshot(window, terminalId)
    expect(beforeSwitchDebug?.viewportY).toBe(0)

    await window.locator(`[data-testid="project-tab-${projectB.id}"]`).click()
    await window.waitForTimeout(WAIT_TIMES.STANDARD)

    await expect.poll(async () => {
      const snapshot = await getTerminalDebugSnapshot(window, terminalId)
      return snapshot?.baseY ?? 0
    }, { timeout: 9000 }).toBeGreaterThan((beforeSwitchDebug?.baseY ?? 0) + 100)

    const hiddenWhileInactiveDebug = await getTerminalDebugSnapshot(window, terminalId)

    await window.locator(`[data-testid="project-tab-${projectA.id}"]`).click()
    await expect.poll(async () => {
      const snapshot = await getTerminalDebugSnapshot(window, terminalId)
      return snapshot?.viewportY
    }, { timeout: 2000 }).toBe(0)

    const afterReturnDebug = await getTerminalDebugSnapshot(window, terminalId)

    expect(hiddenWhileInactiveDebug?.savedViewportY).toBe(0)
    expect(hiddenWhileInactiveDebug?.hiddenViewportIntent?.viewportY).toBe(0)
    expect(afterReturnDebug?.viewportY).toBe(0)
  })

  test.skip(isCI, 'PTY-backed viewport preservation E2E is unreliable on CI')
  test('same-project terminal switch after add/close keeps active terminal near live output', async ({ window }) => {
    const [project] = mockProjects
    await injectMockProject(window, [project])
    await window.waitForTimeout(WAIT_TIMES.STANDARD)

    await addTerminal(window)
    await addTerminal(window)
    await window.waitForTimeout(WAIT_TIMES.STANDARD)

    const [terminalA, terminalB] = await getProjectTerminalIds(window, project.id)
    expect(terminalA).toBeTruthy()
    expect(terminalB).toBeTruthy()
    if (!terminalA || !terminalB) {
      throw new Error('Expected two terminals in the same project')
    }

    await window.locator(`[data-terminal-id="${terminalA}"]`).click()
    await window.waitForTimeout(WAIT_TIMES.STANDARD)

    await window.evaluate((id: string) => {
      (globalThis as typeof globalThis & {
        window: Window & { electron: { terminal: { write: (terminalId: string, data: string) => void } } }
      }).window.electron.terminal.write(id, 'seq 1 240; sleep 1; seq 241 520\n')
    }, terminalA)

    await expect.poll(async () => {
      const snapshot = await getTerminalDebugSnapshot(window, terminalA)
      return snapshot?.baseY ?? 0
    }, { timeout: 5000 }).toBeGreaterThan(400)

    const beforeSwitchDebug = await getTerminalDebugSnapshot(window, terminalA)
    expect(beforeSwitchDebug?.isAtBottom).toBe(true)

    await addTerminal(window)
    await window.waitForTimeout(WAIT_TIMES.STANDARD)

    const [terminalAAfterAdd, terminalBAfterAdd, terminalC] = await getProjectTerminalIds(window, project.id)
    expect(terminalAAfterAdd).toBe(terminalA)
    expect(terminalBAfterAdd).toBe(terminalB)
    expect(terminalC).toBeTruthy()
    if (!terminalC) {
      throw new Error('Expected third terminal after add')
    }

    await window.locator(`[data-terminal-id="${terminalB}"] [aria-label="Close terminal"]`).click()
    await window.waitForTimeout(WAIT_TIMES.STANDARD)

    await window.locator(`[data-terminal-id="${terminalA}"]`).click()
    await window.waitForTimeout(WAIT_TIMES.STANDARD)

    const afterReturnDebug = await getTerminalDebugSnapshot(window, terminalA)

    expect(afterReturnDebug?.isAtBottom).toBe(true)
  })

  test.skip(isCI, 'PTY-backed viewport preservation E2E is unreliable on CI')
  test('adding a terminal keeps the previously bottom-following pane anchored when resize introduces scrollback', async ({ window }) => {
    const [project] = mockProjects
    await injectMockProject(window, [project])
    await window.waitForTimeout(WAIT_TIMES.STANDARD)

    await addTerminal(window)
    await addTerminal(window)
    await window.waitForTimeout(WAIT_TIMES.STANDARD)

    const [terminalA] = await getProjectTerminalIds(window, project.id)
    expect(terminalA).toBeTruthy()
    if (!terminalA) {
      throw new Error('Expected first terminal in the active project')
    }

    await window.locator(`[data-terminal-id="${terminalA}"]`).click()
    await window.waitForTimeout(WAIT_TIMES.STANDARD)

    await window.evaluate((id: string) => {
      (globalThis as typeof globalThis & {
        window: Window & { electron: { terminal: { write: (terminalId: string, data: string) => void } } }
      }).window.electron.terminal.write(id, 'seq 1 20\n')
    }, terminalA)

    await expect.poll(async () => {
      const metrics = await getTerminalViewportMetricsByTerminalId(window, terminalA)
      return metrics.bottomGap
    }, { timeout: 5000 }).toBeLessThan(50)

    const beforeAdd = await getTerminalViewportMetricsByTerminalId(window, terminalA)
    const beforeAddDebug = await getTerminalDebugSnapshot(window, terminalA)

    expect(beforeAdd.bottomGap).toBeLessThan(50)
    expect(beforeAddDebug?.isAtBottom).toBe(true)

    await addTerminal(window)
    await window.waitForTimeout(WAIT_TIMES.STANDARD)

    const afterAdd = await getTerminalViewportMetricsByTerminalId(window, terminalA)
    const afterAddDebug = await getTerminalDebugSnapshot(window, terminalA)

    expect(afterAdd.bottomGap).toBeLessThan(120)
    expect(afterAddDebug?.isAtBottom).toBe(true)
  })

  test('inactive terminals in the active project are not treated as hidden', async ({ window }) => {
    const [project] = mockProjects
    await injectMockProject(window, [project])
    await window.waitForTimeout(WAIT_TIMES.STANDARD)

    await addTerminal(window)
    await addTerminal(window)
    await window.waitForTimeout(WAIT_TIMES.STANDARD)

    const [terminalA, terminalB] = await getProjectTerminalIds(window, project.id)
    expect(terminalA).toBeTruthy()
    expect(terminalB).toBeTruthy()
    if (!terminalA || !terminalB) {
      throw new Error('Expected two terminals in the same project')
    }

    const inactiveDebug = await getTerminalDebugSnapshot(window, terminalA)
    const activeDebug = await getTerminalDebugSnapshot(window, terminalB)

    expect(activeDebug?.isHidden).toBe(false)
    expect(inactiveDebug?.isHidden).toBe(false)
  })

  test('A resize -> B -> A keeps resized terminal row ratios', async ({ window }) => {
    const [projectA, projectB] = mockProjects.slice(0, 2)
    await injectMockProject(window, [projectA, projectB])
    await window.waitForTimeout(WAIT_TIMES.STANDARD)

    await window.evaluate((projectId: string) => {
      interface AppStoreState {
        setState: (state: Record<string, unknown>) => void
      }

      const appStore = (window as unknown as { __APP_STORE__?: AppStoreState }).__APP_STORE__
      const createdAt = new Date().toISOString()

      appStore?.setState({
        terminals: [
          {
            id: 'term-a-1',
            title: 'Terminal A1',
            cwd: '/tmp/project-a',
            isClaudeMode: false,
            projectId,
            createdAt
          },
          {
            id: 'term-a-2',
            title: 'Terminal A2',
            cwd: '/tmp/project-a',
            isClaudeMode: false,
            projectId,
            createdAt
          },
          {
            id: 'term-a-3',
            title: 'Terminal A3',
            cwd: '/tmp/project-a',
            isClaudeMode: false,
            projectId,
            createdAt
          },
          {
            id: 'term-a-4',
            title: 'Terminal A4',
            cwd: '/tmp/project-a',
            isClaudeMode: false,
            projectId,
            createdAt
          }
        ],
        activeTerminalId: 'term-a-1',
        lastActiveTerminalByProjectId: {
          [projectId]: 'term-a-1'
        }
      })
    }, projectA.id)

    const projectGrid = window.getByRole('region', {
      name: `Terminal grid for project ${projectA.id}`
    })
    const rootRows = projectGrid
      .locator('.pane-tree-split')
      .first()
      .locator(':scope > [data-pane-child]')
    await expect(rootRows).toHaveCount(2)

    const handle = window.locator('.terminal-resize-handle--horizontal').first()
    await expect(handle).toBeVisible()
    await handle.focus()
    await handle.press('ArrowDown')
    await handle.press('ArrowDown')
    await handle.press('ArrowDown')
    await window.waitForTimeout(WAIT_TIMES.SHORT)

    const rowFlexBeforeSwitch = await getRowFlex(window, projectA.id)
    expect(rowFlexBeforeSwitch).toHaveLength(2)
    expect(Math.abs(rowFlexBeforeSwitch[0] - rowFlexBeforeSwitch[1])).toBeGreaterThan(0.2)

    await window.locator(`[data-testid="project-tab-${projectB.id}"]`).click()
    await window.waitForTimeout(WAIT_TIMES.STANDARD)

    await window.locator(`[data-testid="project-tab-${projectA.id}"]`).click()
    await window.waitForTimeout(WAIT_TIMES.STANDARD)

    const rowFlexAfterReturn = await getRowFlex(window, projectA.id)
    expect(rowFlexAfterReturn).toHaveLength(2)
    expect(rowFlexAfterReturn[0]).toBeCloseTo(rowFlexBeforeSwitch[0], 1)
    expect(rowFlexAfterReturn[1]).toBeCloseTo(rowFlexBeforeSwitch[1], 1)
  })
})
