import { test as base, _electron as electron, ElectronApplication, Page } from '@playwright/test'
import path from 'path'
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
  app: async ({}, use) => {
    // Launch Electron app from built dist
    const app = await electron.launch({
      args: [path.resolve('./dist/main/index.js'), '--no-sandbox'],
      env: {
        ...process.env,
        NODE_ENV: 'test',
        ELECTRON_DISABLE_SANDBOX: '1'
      }
    })
    await use(app)
    await app.close()
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
 * Helper to inject mock project data into localStorage.
 */
export async function injectMockProject(window: Page, projects: MockProject[]): Promise<void> {
  await window.evaluate((p) => {
    localStorage.setItem('projects', JSON.stringify(p))
  }, projects)
  await window.reload()
  await window.waitForLoadState('domcontentloaded')
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
