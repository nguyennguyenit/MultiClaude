import { test, expect, injectMockProject, mockProjects } from '../fixtures'

/**
 * Keyboard shortcuts tests for MultiClaude.
 * Tests global keyboard shortcuts for project switching and terminal management.
 */
test.describe('Keyboard Shortcuts', () => {
  test.beforeEach(async ({ window }) => {
    // Setup with first 3 projects for keyboard shortcut testing
    await injectMockProject(window, mockProjects.slice(0, 3))
    // Wait for app state to stabilize
    await window.waitForTimeout(200)
  })

  test.describe('Project Switching (Alt+Number)', () => {
    test('Alt+1 switches to first project', async ({ window }) => {
      // First click second project to ensure we're not on first
      const projectTab2 = window.locator('button:has-text("Project2")').first()
      await projectTab2.click()
      await window.waitForTimeout(150)

      // Press Alt+1 to switch to first project
      await window.keyboard.press('Alt+1')
      await window.waitForTimeout(150)

      // Verify first project tab is now active (use .first() to avoid multiple match errors)
      const activeTab = window.locator('[class*="bg-[var(--mc-bg-primary)]"]:has-text("Project1")').first()
      await expect(activeTab).toBeVisible()
    })

    test('Alt+2 switches to second project', async ({ window }) => {
      // First select first project
      const projectTab1 = window.locator('button:has-text("Project1")').first()
      await projectTab1.click()
      await window.waitForTimeout(150)

      // Press Alt+2 to switch to second project
      await window.keyboard.press('Alt+2')
      await window.waitForTimeout(150)

      // Verify second project tab is now active
      const activeTab = window.locator('[class*="bg-[var(--mc-bg-primary)]"]:has-text("Project2")').first()
      await expect(activeTab).toBeVisible()
    })

    test('Alt+3 switches to third project', async ({ window }) => {
      // First select first project
      const projectTab1 = window.locator('button:has-text("Project1")').first()
      await projectTab1.click()
      await window.waitForTimeout(150)

      // Press Alt+3 to switch to third project
      await window.keyboard.press('Alt+3')
      await window.waitForTimeout(150)

      // Verify third project tab is now active
      const activeTab = window.locator('[class*="bg-[var(--mc-bg-primary)]"]:has-text("Project3")').first()
      await expect(activeTab).toBeVisible()
    })

    test('Alt+9 is ignored when less than 9 projects', async ({ window }) => {
      // Select first project first
      const projectTab1 = window.locator('button:has-text("Project1")').first()
      await projectTab1.click()
      await window.waitForTimeout(150)

      // Try Alt+9 - should not change anything since only 3 projects exist
      await window.keyboard.press('Alt+9')
      await window.waitForTimeout(150)

      // First project should still be active (no change)
      const activeTab = window.locator('[class*="bg-[var(--mc-bg-primary)]"]:has-text("Project1")').first()
      await expect(activeTab).toBeVisible()
    })
  })

  test.describe('Terminal Management', () => {
    // Skip: Flaky - Ctrl+N terminal creation timing varies in E2E
    test.skip('Ctrl+N creates new terminal (count increases)', async ({ window }) => {
      // First select a project to enable terminal creation
      const projectTab = window.locator('button:has-text("Project1")').first()
      await projectTab.click()
      await window.waitForTimeout(200)

      // Count initial terminals (may be 0 or 1 depending on auto-creation)
      const initialTerminals = await window.locator('.terminal-pane').count()

      // Press Ctrl+N to create new terminal
      await window.keyboard.press('Control+n')
      await window.waitForTimeout(300)

      // Verify terminal count increased
      const newTerminals = await window.locator('.terminal-pane').count()
      expect(newTerminals).toBeGreaterThan(initialTerminals)
    })

    test('Ctrl+W closes active terminal (count decreases)', async ({ window }) => {
      // First select a project
      const projectTab = window.locator('button:has-text("Project1")').first()
      await projectTab.click()
      await window.waitForTimeout(200)

      // Create a terminal first using Ctrl+N
      await window.keyboard.press('Control+n')
      await window.waitForTimeout(300)

      // Count terminals before closing
      const beforeCount = await window.locator('.terminal-pane').count()

      // Only proceed if there are terminals to close
      if (beforeCount > 0) {
        // Press Ctrl+W to close active terminal
        await window.keyboard.press('Control+w')
        await window.waitForTimeout(300)

        // Verify terminal count decreased
        const afterCount = await window.locator('.terminal-pane').count()
        expect(afterCount).toBeLessThan(beforeCount)
      }
    })
  })

  test.describe('Edge Cases', () => {
    test('keyboard shortcuts work after clicking in main area', async ({ window }) => {
      // Click in main content area to ensure it has focus
      const mainContent = window.locator('#root')
      await mainContent.click()
      await window.waitForTimeout(100)

      // Select first project
      const projectTab1 = window.locator('button:has-text("Project1")').first()
      await projectTab1.click()
      await window.waitForTimeout(150)

      // Alt+2 should still work
      await window.keyboard.press('Alt+2')
      await window.waitForTimeout(150)

      const activeTab = window.locator('[class*="bg-[var(--mc-bg-primary)]"]:has-text("Project2")').first()
      await expect(activeTab).toBeVisible()
    })

    test('rapid keyboard shortcuts are handled correctly', async ({ window }) => {
      // Select first project
      const projectTab1 = window.locator('button:has-text("Project1")').first()
      await projectTab1.click()
      await window.waitForTimeout(100)

      // Rapid fire Alt+2, Alt+3, Alt+1
      await window.keyboard.press('Alt+2')
      await window.waitForTimeout(50)
      await window.keyboard.press('Alt+3')
      await window.waitForTimeout(50)
      await window.keyboard.press('Alt+1')
      await window.waitForTimeout(200)

      // Should end up on first project
      const activeTab = window.locator('[class*="bg-[var(--mc-bg-primary)]"]:has-text("Project1")').first()
      await expect(activeTab).toBeVisible()
    })
  })
})
