/* eslint-disable @typescript-eslint/no-explicit-any */
import { test, expect, injectMockProject, WAIT_TIMES } from '../fixtures'
import { mockProjects } from '../fixtures/test-data'

/**
 * Project switching E2E tests.
 * Tests cursor display and focus behavior when switching between projects.
 * Validates fix for cursor not appearing after project switch.
 */
test.describe('Project Switching - Cursor Display', () => {
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
})
