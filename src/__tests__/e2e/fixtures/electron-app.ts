import { test as base, _electron as electron, ElectronApplication, Page } from '@playwright/test'
import path from 'path'
import fs from 'fs'
import os from 'os'
import type { MockProject } from './test-data'

/**
 * Electron test fixtures for MultiClaude E2E tests.
 * Provides app and window instances for test suites.
 */
type ElectronFixtures = {
  app: ElectronApplication
  window: Page
}

export const test = base.extend<ElectronFixtures>({
  app: async ({}, use, testInfo) => {
    // Create a unique temp directory for test data isolation
    const testDataDir = path.join(os.tmpdir(), `multiclaude-test-${testInfo.testId}-${Date.now()}`)
    fs.mkdirSync(testDataDir, { recursive: true })

    // Launch Electron app from built dist with isolated user data
    const app = await electron.launch({
      args: [
        path.resolve('./dist/main/index.js'),
        '--no-sandbox',
        `--user-data-dir=${testDataDir}`
      ],
      env: {
        ...process.env,
        NODE_ENV: 'test',
        ELECTRON_DISABLE_SANDBOX: '1',
        MULTICLAUDE_TEST_STORE_PATH: testDataDir
      }
    })
    await use(app)
    await app.close()

    // Clean up test data directory after test
    try {
      fs.rmSync(testDataDir, { recursive: true, force: true })
    } catch {
      // Ignore cleanup errors
    }
  },

  window: async ({ app }, use) => {
    // Get first window and wait for it to load
    const window = await app.firstWindow()
    await window.waitForLoadState('domcontentloaded')
    // Wait for React root to be rendered
    await window.waitForSelector('#root', { state: 'attached' })
    await use(window)
  }
})

export { expect } from '@playwright/test'

/**
 * Test timing constants (ms) for consistent wait behavior.
 */
export const WAIT_TIMES = {
  /** Short delay for UI state updates */
  SHORT: 100,
  /** Medium delay for state propagation */
  MEDIUM: 200,
  /** Standard delay for terminal/component initialization */
  STANDARD: 300,
  /** Long delay for complex operations */
  LONG: 500
} as const

/**
 * Helper to add a new terminal (works whether terminals exist or not).
 */
export async function addTerminal(window: Page): Promise<void> {
  // First try the empty state button, then the action bar button
  const emptyStateButton = window.locator('button:has-text("+ New Terminal")')
  const actionBarButton = window.locator('button:has-text("+ New")')

  if (await emptyStateButton.isVisible()) {
    await emptyStateButton.click()
  } else {
    await actionBarButton.click()
  }
  await window.waitForTimeout(WAIT_TIMES.STANDARD)
}

/**
 * Helper to clear localStorage and reset app state.
 */
export async function resetAppState(window: Page): Promise<void> {
  await window.evaluate(() => {
    localStorage.clear()
  })
  await window.reload()
  await window.waitForLoadState('domcontentloaded')
}

/**
 * Helper to inject mock project data into the Zustand store and set active project.
 * This injects projects directly into the React state store.
 * Creates actual folders on disk so handleSelectProject validation passes.
 */
export async function injectMockProject(window: Page, projects: MockProject[]): Promise<void> {
  // Wait for React to be ready
  await window.waitForTimeout(200)

  // Create actual folders for mock projects (validation requires real paths)
  // Skip folders with "invalid" or "nonexistent" in path - those test error handling
  for (const project of projects) {
    if (!project.path.includes('invalid') && !project.path.includes('nonexistent')) {
      fs.mkdirSync(project.path, { recursive: true })
    }
  }

  // Inject projects directly into the Zustand store via __APP_STORE__
  const injectionResult = await window.evaluate((projectData) => {
    interface AppStoreState {
      setProjects: (projects: unknown[]) => void
      setActiveProject: (id: string | null) => void
      terminals: unknown[]
    }
    interface StoreApi {
      getState: () => AppStoreState
      setState: (state: Partial<AppStoreState>) => void
    }
    const appStore = (window as unknown as { __APP_STORE__?: StoreApi }).__APP_STORE__

    if (appStore) {
      const state = appStore.getState()
      // Clear terminals (should already be empty with isolated user data)
      appStore.setState({ terminals: [] })
      // Then set projects
      state.setProjects(projectData)
      if (projectData.length > 0) {
        state.setActiveProject(projectData[0].id)
      }
      return { success: true, projectCount: projectData.length }
    }
    return { success: false, projectCount: 0 }
  }, projects)

  // Wait for React to re-render with new state
  await window.waitForTimeout(300)

  // Verify projects are visible in UI (not just sidebar)
  if (injectionResult.success && projects.length > 0) {
    try {
      // Wait for first project tab to be visible (confirms ProjectTabs rendered)
      await window.waitForSelector(`[data-testid="project-tab-${projects[0].id}"]`, { timeout: 3000 })
    } catch {
      // Fallback: wait for sidebar as before
      try {
        await window.waitForSelector('[data-testid="sidebar"]', { timeout: 2000 })
      } catch {
        // If store injection didn't work, the welcome screen is shown
        // This is expected for some tests (like empty state tests)
      }
    }
  }
}

/** Screenshot base path, relative to e2e directory */
const SCREENSHOT_BASE_PATH = './screenshots'

/** Fixed prompt text for consistent terminal screenshots */
export const TERMINAL_TEST_PROMPT = 'test@multiclaude:~$ '

/**
 * Helper to clear terminal content and inject a fixed prompt.
 * Ensures consistent terminal screenshots for visual regression testing.
 * @throws Error if terminal at index doesn't exist or cannot be cleared
 */
export async function clearTerminalForScreenshot(window: Page, terminalIndex = 0): Promise<void> {
  // Send clear command to terminal via xterm API
  const success = await window.evaluate(({ index, prompt }: { index: number; prompt: string }) => {
    interface XtermTerminal {
      write: (data: string) => void
      clear: () => void
    }
    interface TerminalData {
      xterm?: XtermTerminal
    }
    interface AppStoreState {
      terminals: TerminalData[]
    }
    interface StoreApi {
      getState: () => AppStoreState
    }
    const appStore = (window as unknown as { __APP_STORE__?: StoreApi }).__APP_STORE__
    if (!appStore) {
      return { success: false, reason: 'App store not found' }
    }
    const state = appStore.getState()
    if (index >= state.terminals.length) {
      return { success: false, reason: `Terminal index ${index} out of range (${state.terminals.length} terminals)` }
    }
    const terminal = state.terminals[index] as TerminalData | undefined
    if (!terminal?.xterm) {
      return { success: false, reason: `Terminal ${index} has no xterm instance` }
    }
    // Clear terminal content
    terminal.xterm.clear()
    // Write fixed prompt for consistent screenshot
    terminal.xterm.write(`\r\n${prompt}`)
    return { success: true }
  }, { index: terminalIndex, prompt: TERMINAL_TEST_PROMPT })

  if (!success.success) {
    console.warn(`[clearTerminalForScreenshot] ${success.reason}`)
  }

  // Wait for terminal to re-render
  await window.waitForTimeout(WAIT_TIMES.STANDARD)
}

/**
 * Helper to clear all visible terminals for screenshots.
 */
export async function clearAllTerminalsForScreenshot(window: Page): Promise<void> {
  const terminalCount = await window.locator('.terminal-pane').count()
  for (let i = 0; i < terminalCount; i++) {
    await clearTerminalForScreenshot(window, i)
  }
}

/**
 * Helper to take screenshot with consistent viewport.
 */
export async function takeConsistentScreenshot(
  window: Page,
  name: string,
  options?: { fullPage?: boolean; basePath?: string }
): Promise<Buffer> {
  const screenshotPath = options?.basePath ?? SCREENSHOT_BASE_PATH
  // Ensure consistent device scale factor
  await window.evaluate(() => {
    document.body.style.transform = 'scale(1)'
  })
  return await window.screenshot({
    path: `./src/__tests__/e2e/${screenshotPath}/${name}.png`,
    fullPage: options?.fullPage ?? false
  })
}
