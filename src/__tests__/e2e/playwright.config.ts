import { defineConfig } from '@playwright/test'

/**
 * Playwright configuration for MultiClaude Electron E2E tests.
 * Uses native _electron API for app testing.
 */
export default defineConfig({
  testDir: './tests',
  globalSetup: './global-setup.ts',
  outputDir: './test-artifacts',
  timeout: 30000,
  retries: 1,
  fullyParallel: false, // Electron tests should run sequentially
  workers: 1,
  reporter: [
    ['list'],
    ['html', { outputFolder: './test-results/html-report' }]
  ],
  use: {
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'on-first-retry'
  },
  expect: {
    toHaveScreenshot: {
      // 2% threshold for terminal anti-aliasing, 1% for static UI
      maxDiffPixelRatio: 0.02,
      animations: 'disabled'
    }
  },
  projects: [
    {
      name: 'electron',
      testMatch: '**/*.spec.ts'
    }
  ]
})
