import { test, expect, resetAppState, injectMockProject, mockProject, mockProjects } from '../fixtures'

// Skip PTY-dependent tests on CI (terminal creation can be unreliable)
const isCI = process.env.CI === 'true'

/**
 * State transition tests for MultiClaude.
 * Tests empty states, toast notifications, and error handling.
 */
test.describe('State Transitions', () => {
  test.describe('Empty States', () => {
    test('no projects shows welcome message', async ({ window }) => {
      // Clear all projects to get empty state
      await resetAppState(window)
      await window.waitForTimeout(200)

      // Verify welcome screen is displayed
      const welcomeText = window.getByRole('heading', { name: 'MultiClaude' })
      await expect(welcomeText).toBeVisible()

      // Verify "Add Project" button is visible
      const addProjectBtn = window.locator('button:has-text("Add Project")')
      await expect(addProjectBtn).toBeVisible()
    })

    test('no terminals shows empty state message and add button', async ({ window }) => {
      // Inject a project first
      await injectMockProject(window, [mockProject])
      await window.waitForTimeout(200)

      // Select the project
      const projectTab = window.locator('[data-testid="project-tab-test-project-1"]')
      await projectTab.click()
      await window.waitForTimeout(300)

      await expect(window.getByRole('heading', { name: 'Multi Terminals' })).toBeVisible()

      // Verify "New Terminal" button is visible
      const newTerminalBtn = window.getByRole('button', { name: '+ New Terminal' })
      await expect(newTerminalBtn).toBeVisible()
    })

    test('clicking "New Terminal" creates a terminal', async ({ window }) => {
      // Setup with project and no terminals
      await injectMockProject(window, [mockProject])
      await window.waitForTimeout(200)

      const projectTab = window.locator('[data-testid="project-tab-test-project-1"]')
      await projectTab.click()
      await window.waitForTimeout(300)

      // Click "New Terminal" button
      await window.getByRole('button', { name: '+ New Terminal' }).click()
      await expect(window.locator('[data-terminal-id]')).toHaveCount(1)
    })

    test('no projects shows hint about adding', async ({ window }) => {
      // Clear state
      await resetAppState(window)
      await window.waitForTimeout(200)

      const hint = window.locator('[data-testid="project-tabs-empty"]')
      await expect(hint).toBeVisible()
    })
  })

  test.describe('Toast Notifications', () => {
    // Skip on CI - this test creates terminals via Ctrl+n which requires PTY
    test.skip(isCI, 'Terminal creation requires PTY')
    test('terminal limit toast appears when limit reached', async ({ window }) => {
      // This test triggers the terminal limit warning
      await injectMockProject(window, [mockProject])
      await window.waitForTimeout(200)

      const projectTab = window.locator('[data-testid="project-tab-test-project-1"]')
      await projectTab.click()
      await window.waitForTimeout(200)

      // Create terminals up to limit (default is likely 2 or more)
      // Create multiple terminals rapidly
      for (let i = 0; i < 12; i++) {
        await window.keyboard.press('Control+n')
        await window.waitForTimeout(150)
      }

      const toast = window.locator('text=Terminal limit reached').first()
      await expect(toast).toBeVisible()
      await expect(window.locator('[data-terminal-id]')).toHaveCount(9)
    })
  })

  test.describe('Error States', () => {
    test('project folder validation shows warning for invalid path', async ({ window }) => {
      // Create a project with a path that might not exist
      // We inject the mock project data which has /tmp/test-project path
      await injectMockProject(window, [{
        ...mockProject,
        path: '/nonexistent/invalid/path/that/does/not/exist'
      }])
      await window.waitForTimeout(200)

      // Try to select the project with invalid path
      const projectTab = window.locator('[data-testid="project-tab-test-project-1"]')

      if (await projectTab.isVisible().catch(() => false)) {
        await projectTab.click()
      }

      const warningToast = window.locator('text=folder no longer exists')
      await expect.poll(async () =>
        await warningToast.isVisible().catch(() => false)
        || await projectTab.count() === 0
      ).toBe(true)
    })

    test('app handles state transitions gracefully', async ({ window }) => {
      // Test rapid state changes don't crash the app
      await injectMockProject(window, mockProjects.slice(0, 3))
      await window.waitForTimeout(200)

      // Rapidly switch between projects
      for (let i = 1; i <= 3; i++) {
        await window.keyboard.press(`Alt+${i}`)
        await window.waitForTimeout(50)
      }
      await window.waitForTimeout(200)

      // App should still be functional
      const root = window.locator('#root')
      await expect(root).toBeVisible()

      // Should be on project 3
      const activeTab = window.locator('[data-testid="project-tab-test-project-3"]')
      await expect(activeTab).toHaveClass(/active/)
    })
  })

  test.describe('View Transitions', () => {
    test('switching between projects preserves UI state', async ({ window }) => {
      await injectMockProject(window, mockProjects.slice(0, 2))
      await window.waitForTimeout(200)

      // Select first project and create a terminal
      await window.keyboard.press('Alt+1')
      const firstProjectTab = window.locator('[data-testid="project-tab-test-project-1"]')
      await expect(firstProjectTab).toHaveClass(/active/)
      await window.keyboard.press('Control+n')
      await expect(window.locator('[data-terminal-id]')).toHaveCount(1)

      // Switch to second project
      await window.keyboard.press('Alt+2')
      await expect(window.locator('[data-testid="project-tab-test-project-2"]')).toHaveClass(/active/)
      await expect(window.locator('[data-terminal-id]:visible')).toHaveCount(0)

      // Switch back to first project
      await window.keyboard.press('Alt+1')
      await expect(firstProjectTab).toHaveClass(/active/)
      await expect(window.locator('[data-terminal-id]:visible')).toHaveCount(1)
    })

    test('empty state disappears when terminal is added', async ({ window }) => {
      await injectMockProject(window, [mockProject])
      await window.waitForTimeout(200)

      const projectTab = window.locator('[data-testid="project-tab-test-project-1"]')
      await projectTab.click()
      const emptyHeading = window.getByRole('heading', { name: 'Multi Terminals' })
      await expect(emptyHeading).toBeVisible()

      // Add terminal
      await window.getByRole('button', { name: '+ New Terminal' }).click()

      // Empty state should be gone
      await expect(emptyHeading).not.toBeVisible()

      // Terminal should be visible
      await expect(window.locator('[data-terminal-id]')).toHaveCount(1)
    })
  })
})
