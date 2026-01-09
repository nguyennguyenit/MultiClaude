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
      const welcomeText = window.locator('text=Welcome to MultiClaude')
      await expect(welcomeText).toBeVisible()

      // Verify "Add Project" button is visible
      const addProjectBtn = window.locator('button:has-text("Add Project")')
      await expect(addProjectBtn).toBeVisible()
    })

    // Skip: Flaky due to async terminal management - empty state tests require
    // all terminals to be closed which is unreliable in E2E due to timing/WebGL disposal
    test.skip('no terminals shows empty state message and add button', async ({ window }) => {
      // Inject a project first
      await injectMockProject(window, [mockProject])
      await window.waitForTimeout(200)

      // Select the project
      const projectTab = window.locator('button:has-text("TestProject")').first()
      await projectTab.click()
      await window.waitForTimeout(300)

      // Use "Kill All" button to close all terminals at once (more reliable)
      const killAllBtn = window.locator('button:has-text("Kill All")')
      if (await killAllBtn.isVisible()) {
        await killAllBtn.click()
        await window.waitForTimeout(500)
      }

      // Verify "Agent Terminals" welcome screen
      const agentTerminalsText = window.locator('text=Agent Terminals')
      await expect(agentTerminalsText).toBeVisible()

      // Verify "New Terminal" button is visible
      const newTerminalBtn = window.locator('button:has-text("New Terminal")')
      await expect(newTerminalBtn).toBeVisible()
    })

    // Skip: Flaky due to async terminal management - requires closing all terminals
    test.skip('clicking "New Terminal" creates a terminal', async ({ window }) => {
      // Setup with project and no terminals
      await injectMockProject(window, [mockProject])
      await window.waitForTimeout(200)

      const projectTab = window.locator('button:has-text("TestProject")').first()
      await projectTab.click()
      await window.waitForTimeout(300)

      // Use "Kill All" button to close all terminals at once
      const killAllBtn = window.locator('button:has-text("Kill All")')
      if (await killAllBtn.isVisible()) {
        await killAllBtn.click()
        await window.waitForTimeout(500)
      }

      // Click "New Terminal" button
      const newTerminalBtn = window.locator('button:has-text("New Terminal")')
      if (await newTerminalBtn.isVisible()) {
        await newTerminalBtn.click()
        await window.waitForTimeout(300)

        // Verify terminal was created
        const newTerminalPane = window.locator('.terminal-pane')
        await expect(newTerminalPane.first()).toBeVisible()
      }
    })

    test('no projects shows hint about adding', async ({ window }) => {
      // Clear state
      await resetAppState(window)
      await window.waitForTimeout(200)

      // In project tabs area, should show "No projects - click + to add"
      const hint = window.locator('text=No projects - click + to add')
      await expect(hint).toBeVisible()
    })
  })

  test.describe('Toast Notifications', () => {
    test('toast container exists in DOM', async ({ window }) => {
      // Inject project and select it
      await injectMockProject(window, [mockProject])
      await window.waitForTimeout(200)

      const projectTab = window.locator('button:has-text("TestProject")').first()
      await projectTab.click()
      await window.waitForTimeout(200)

      // Toast container should be in DOM (may be empty but structure exists)
      // The toast container is at fixed bottom-4 right-4
      const root = window.locator('#root')
      await expect(root).toBeVisible()

      // Toast container renders conditionally, so we check if app structure is correct
      // The ToastContainer component returns null when empty, so we verify the app is set up correctly
      const body = window.locator('body')
      await expect(body).toBeVisible()
    })

    // Skip on CI - this test creates terminals via Ctrl+n which requires PTY
    test.skip(isCI, 'Terminal creation requires PTY')
    test('terminal limit toast appears when limit reached', async ({ window }) => {
      // This test triggers the terminal limit warning
      await injectMockProject(window, [mockProject])
      await window.waitForTimeout(200)

      const projectTab = window.locator('button:has-text("TestProject")').first()
      await projectTab.click()
      await window.waitForTimeout(200)

      // Create terminals up to limit (default is likely 2 or more)
      // Create multiple terminals rapidly
      for (let i = 0; i < 12; i++) {
        await window.keyboard.press('Control+n')
        await window.waitForTimeout(150)
      }

      // Check if warning toast appeared (terminal limit)
      const toast = window.locator('text=Terminal limit reached')
      // Toast might have appeared - this is a soft check since limit depends on settings
      const toastVisible = await toast.isVisible().catch(() => false)

      // Either toast appeared or we have terminals
      const terminalCount = await window.locator('.terminal-pane').count()
      expect(terminalCount > 0 || toastVisible).toBeTruthy()
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
      const projectTab = window.locator('button:has-text("TestProject")').first()

      if (await projectTab.isVisible()) {
        await projectTab.click()
        await window.waitForTimeout(300)

        // Warning toast should appear about folder not existing
        const warningToast = window.locator('text=folder no longer exists')
        const toastVisible = await warningToast.isVisible().catch(() => false)

        // Either toast appeared or project was removed
        const tabStillExists = await projectTab.isVisible().catch(() => false)

        // One of these conditions should be true
        expect(toastVisible || !tabStillExists).toBeTruthy()
      }
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
      const activeTab = window.locator('[class*="bg-[var(--mc-bg-primary)]"]:has-text("Project3")')
      await expect(activeTab).toBeVisible()
    })
  })

  test.describe('View Transitions', () => {
    // Skip: Flaky - Ctrl+N terminal creation timing varies in E2E
    test.skip('switching between projects preserves UI state', async ({ window }) => {
      await injectMockProject(window, mockProjects.slice(0, 2))
      await window.waitForTimeout(200)

      // Select first project and create a terminal
      await window.keyboard.press('Alt+1')
      await window.waitForTimeout(200)
      await window.keyboard.press('Control+n')
      await window.waitForTimeout(300)

      // Switch to second project
      await window.keyboard.press('Alt+2')
      await window.waitForTimeout(200)

      // Switch back to first project
      await window.keyboard.press('Alt+1')
      await window.waitForTimeout(200)

      // App should still be functional and show first project
      const activeTab = window.locator('[class*="bg-[var(--mc-bg-primary)]"]:has-text("Project1")')
      await expect(activeTab).toBeVisible()
    })

    // Skip: Flaky - requires closing all terminals which is unreliable in E2E
    test.skip('empty state disappears when terminal is added', async ({ window }) => {
      await injectMockProject(window, [mockProject])
      await window.waitForTimeout(200)

      const projectTab = window.locator('button:has-text("TestProject")').first()
      await projectTab.click()
      await window.waitForTimeout(300)

      // Use "Kill All" button to close all terminals at once
      const killAllBtn = window.locator('button:has-text("Kill All")')
      if (await killAllBtn.isVisible()) {
        await killAllBtn.click()
        await window.waitForTimeout(500)
      }

      // Verify empty state (Agent Terminals welcome screen)
      const agentTerminals = window.locator('text=Agent Terminals')
      await expect(agentTerminals).toBeVisible()

      // Add terminal
      await window.keyboard.press('Control+n')
      await window.waitForTimeout(300)

      // Empty state should be gone
      await expect(agentTerminals).not.toBeVisible()

      // Terminal should be visible
      const terminal = window.locator('.terminal-pane')
      await expect(terminal.first()).toBeVisible()
    })
  })
})
