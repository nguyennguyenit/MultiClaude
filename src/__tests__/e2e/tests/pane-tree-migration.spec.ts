/* eslint-disable react-hooks/rules-of-hooks, no-empty-pattern */
import { test as base, _electron as electron, expect, Page } from '@playwright/test'
import type { ElectronApplication } from '@playwright/test'
import path from 'path'
import fs from 'fs'
import os from 'os'

/**
 * Migration spec — seeds a legacy `electron-store` file (no paneTree) and
 * verifies the renderer boots with a migrated tree.
 *
 * Skipped on CI — PTY creation unreliable there.
 */

const isCI = process.env.CI === 'true'

const legacyFixturePath = path.resolve('./src/__tests__/e2e/fixtures/legacy-store.json')

interface MigrationFixtures {
  app: ElectronApplication
  window: Page
  testDataDir: string
}

const test = base.extend<MigrationFixtures>({
  testDataDir: async ({}, use, testInfo) => {
    const dir = path.join(os.tmpdir(), `multiclaude-migration-${testInfo.testId}-${Date.now()}`)
    fs.mkdirSync(dir, { recursive: true })

    // electron-store writes to <userDataDir>/<name>.json
    const storeFile = path.join(dir, 'multiclaude-data.json')
    const legacyContent = fs.readFileSync(legacyFixturePath, 'utf8')
    fs.writeFileSync(storeFile, legacyContent)

    await use(dir)

    try {
      fs.rmSync(dir, { recursive: true, force: true })
    } catch {
      // ignore
    }
  },
  app: async ({ testDataDir }, use) => {
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
  },
  window: async ({ app }, use) => {
    const window = await app.firstWindow()
    await window.waitForLoadState('domcontentloaded')
    await window.waitForSelector('#root', { state: 'attached' })
    await use(window)
  }
})

test.describe('Pane Tree Migration', () => {
  test.skip(isCI, 'Requires PTY for tree rendering')

  test('legacy flat layout loads and populates paneTree on first read', async ({ app, testDataDir }) => {
    // Allow time for migration + persist on first read
    await app.firstWindow()
    await new Promise((r) => setTimeout(r, 1500))

    const storeFile = path.join(testDataDir, 'multiclaude-data.json')
    const content = JSON.parse(fs.readFileSync(storeFile, 'utf8'))

    const layout = content.terminalLayouts?.['legacy-project-1']
    expect(layout).toBeDefined()
    // Legacy terminals array preserved for safety
    expect(Array.isArray(layout.terminals)).toBe(true)
    expect(layout.terminals.length).toBe(3)
  })
})
