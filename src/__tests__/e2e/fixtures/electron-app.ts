import { test as base, expect, _electron as electron, ElectronApplication, Page } from '@playwright/test'
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

export async function closeElectronApp(app: ElectronApplication): Promise<void> {
  const child = app.process()
  let timeout: NodeJS.Timeout | undefined
  const closedGracefully = await Promise.race([
    app.close().then(() => true, () => false),
    new Promise<boolean>((resolve) => {
      timeout = setTimeout(() => resolve(false), 5_000)
    })
  ])
  if (timeout) clearTimeout(timeout)

  if (!closedGracefully && child.exitCode === null) {
    child.kill('SIGKILL')
    await Promise.race([
      new Promise<void>((resolve) => child.once('exit', () => resolve())),
      new Promise<void>((resolve) => setTimeout(resolve, 1_000))
    ])
  }
}

export async function launchElectronApp(testDataDir: string): Promise<ElectronApplication> {
  let lastError: unknown
  for (let attempt = 1; attempt <= 2; attempt++) {
    const app = await electron.launch({
      args: [
        path.resolve('./dist/main/index.js'),
        '--no-sandbox',
        '--e2e',
        `--user-data-dir=${testDataDir}`
      ],
      env: {
        ...process.env,
        NODE_ENV: 'test',
        ELECTRON_DISABLE_SANDBOX: '1',
        MULTICLAUDE_TEST_STORE_PATH: testDataDir
      }
    })

    try {
      await app.firstWindow({ timeout: 5_000 })
      return app
    } catch (error) {
      lastError = error
      await closeElectronApp(app)
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error('Electron did not create its first test window')
}

export const test = base.extend<ElectronFixtures>({
  app: async ({}, use, testInfo) => {
    // Create a unique temp directory for test data isolation
    const testDataDir = path.join(os.tmpdir(), `multiclaude-test-${testInfo.testId}-${Date.now()}`)
    fs.mkdirSync(testDataDir, { recursive: true })

    // Launch Electron app from built output with isolated user data.
    // A bounded retry covers the occasional macOS launch that starts a
    // process but never publishes a Playwright window after many rapid runs.
    const app = await launchElectronApp(testDataDir)
    try {
      await use(app)
    } finally {
      await closeElectronApp(app)

      // Clean up test data directory after test
      try {
        fs.rmSync(testDataDir, { recursive: true, force: true })
      } catch {
        // Ignore cleanup errors
      }
    }
  },

  window: async ({ app }, use) => {
    // Get first window and wait for it to load
    const window = app.windows()[0] ?? await app.firstWindow()
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
  const terminalRoots = window.locator('[data-terminal-id]')
  const initialCount = await terminalRoots.count()
  const actionBarButton = window.getByRole('button', { name: 'New Terminal', exact: true })
  const emptyStateButton = window.getByRole('button', { name: /\+ New Terminal/ })

  if (await actionBarButton.isVisible()) {
    await actionBarButton.click()
  } else {
    await emptyStateButton.click()
  }

  await expect(terminalRoots).toHaveCount(initialCount + 1)
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
 * Normalize terminal content for visual regression screenshots.
 *
 * Terminal instances are intentionally not exposed through the app store. The
 * screenshot harness therefore hides only xterm's volatile paint surface and
 * adds a deterministic prompt in the test page. Layout, terminal background,
 * pane chrome, and theme styling remain visible.
 *
 * @throws Error if the requested terminal is not mounted
 */
export async function clearTerminalForScreenshot(window: Page, terminalIndex = 0): Promise<void> {
  const terminal = window.locator('[data-terminal-id]').nth(terminalIndex)
  await expect(terminal).toBeAttached()
  await terminal.evaluate((terminalPane, prompt) => {
    const wrapper = terminalPane.querySelector<HTMLElement>('.terminal-container-wrapper')
    const container = terminalPane.querySelector<HTMLElement>('.terminal-container')
    const xterm = container?.querySelector<HTMLElement>('.xterm')

    if (!wrapper || !container || !xterm) {
      throw new Error('Mounted terminal is missing its xterm paint surface')
    }

    xterm.style.visibility = 'hidden'

    let normalizedPrompt = wrapper.querySelector<HTMLElement>(
      '[data-testid="terminal-screenshot-prompt"]'
    )
    if (!normalizedPrompt) {
      normalizedPrompt = document.createElement('div')
      normalizedPrompt.dataset.testid = 'terminal-screenshot-prompt'
      Object.assign(normalizedPrompt.style, {
        position: 'absolute',
        top: '8px',
        left: '8px',
        zIndex: '10',
        pointerEvents: 'none',
        whiteSpace: 'pre',
        color: 'var(--text-primary)',
        fontFamily: 'var(--terminal-font)',
        fontSize: '14px',
        lineHeight: '20px'
      })
      wrapper.append(normalizedPrompt)
    }
    normalizedPrompt.textContent = prompt
  }, TERMINAL_TEST_PROMPT)
  await expect(
    terminal.locator('[data-testid="terminal-screenshot-prompt"]')
  ).toHaveText(TERMINAL_TEST_PROMPT)

  // Wait for terminal to re-render
  await window.waitForTimeout(WAIT_TIMES.STANDARD)
}

/**
 * Helper to clear all visible terminals for screenshots.
 */
export async function clearAllTerminalsForScreenshot(window: Page): Promise<void> {
  const terminalCount = await window.locator('[data-terminal-id]').count()
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
