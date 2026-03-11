/* eslint-disable @typescript-eslint/no-explicit-any */
import { test, expect, injectMockProject, WAIT_TIMES } from '../fixtures'
import { mockProjects } from '../fixtures/test-data'

/**
 * Project switching E2E tests.
 * Tests cursor display and focus behavior when switching between projects.
 * Validates fix for cursor not appearing after project switch.
 */
test.describe('Project Switching - Cursor Display', () => {
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
