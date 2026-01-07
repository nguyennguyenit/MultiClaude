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
 */
export async function injectMockProject(window: Page, projects: MockProject[]): Promise<void> {
  // Wait for React to be ready
  await window.waitForTimeout(200)

  // Inject projects directly into the Zustand store via __APP_STORE__
  await window.evaluate((projectData) => {
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
    }
  }, projects)

  // Wait for React to re-render with new state
  await window.waitForTimeout(200)

  // Verify sidebar is visible (indicates project loaded properly)
  try {
    await window.waitForSelector('[data-testid="sidebar"]', { timeout: 2000 })
  } catch {
    // If store injection didn't work, the welcome screen is shown
    // This is expected for some tests (like empty state tests)
  }
}

/** Screenshot base path, relative to e2e directory */
const SCREENSHOT_BASE_PATH = './screenshots'

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
