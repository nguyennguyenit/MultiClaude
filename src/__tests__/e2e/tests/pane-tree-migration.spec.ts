/* eslint-disable react-hooks/rules-of-hooks, no-empty-pattern */
import { test as base, expect, Page } from '@playwright/test'
import type { ElectronApplication } from '@playwright/test'
import path from 'path'
import fs from 'fs'
import os from 'os'
import { closeElectronApp, launchElectronApp } from '../fixtures/electron-app'

/**
 * Migration spec — seeds a legacy `electron-store` file (no paneTree) and
 * verifies the first canonical pane-tree read migrates and persists it.
 *
 */

const legacyFixturePath = path.resolve('./src/__tests__/e2e/fixtures/legacy-store.json')

interface MigrationFixtures {
  app: ElectronApplication
  window: Page
  testDataDir: string
}

function collectLeafIds(node: unknown): string[] {
  if (!node || typeof node !== 'object') return []
  const candidate = node as {
    kind?: unknown
    terminalId?: unknown
    children?: unknown
  }
  if (candidate.kind === 'leaf' && typeof candidate.terminalId === 'string') {
    return [candidate.terminalId]
  }
  if (candidate.kind === 'split' && Array.isArray(candidate.children)) {
    return candidate.children.flatMap(collectLeafIds)
  }
  return []
}

const test = base.extend<MigrationFixtures>({
  testDataDir: async ({}, use, testInfo) => {
    const dir = path.join(os.tmpdir(), `multiclaude-migration-${testInfo.testId}-${Date.now()}`)
    fs.mkdirSync(dir, { recursive: true })

    // electron-store writes to <userDataDir>/<name>.json
    const projectDir = path.join(dir, 'legacy-project')
    fs.mkdirSync(projectDir, { recursive: true })

    const storeFile = path.join(dir, 'multiclaude-data.json')
    const legacyContent = JSON.parse(fs.readFileSync(legacyFixturePath, 'utf8'))
    legacyContent.projects[0].path = projectDir
    for (const terminal of legacyContent.terminalLayouts['legacy-project-1'].terminals) {
      terminal.cwd = projectDir
    }
    fs.writeFileSync(storeFile, JSON.stringify(legacyContent, null, 2))

    await use(dir)

    try {
      fs.rmSync(dir, { recursive: true, force: true })
    } catch {
      // ignore
    }
  },
  app: async ({ testDataDir }, use) => {
    const app = await launchElectronApp(testDataDir)
    try {
      await use(app)
    } finally {
      await closeElectronApp(app)
    }
  },
  window: async ({ app }, use) => {
    const window = app.windows()[0] ?? await app.firstWindow()
    await window.waitForLoadState('domcontentloaded')
    await window.waitForSelector('#root', { state: 'attached' })
    await use(window)
  }
})

test.describe('Pane Tree Migration', () => {
  test('legacy flat layout populates paneTree on first canonical read', async ({ window, testDataDir }) => {
    const seededStore = JSON.parse(
      fs.readFileSync(path.join(testDataDir, 'multiclaude-data.json'), 'utf8')
    )
    expect(seededStore.projects?.map((project: { id: string }) => project.id))
      .toContain('legacy-project-1')

    await expect.poll(async () => {
      const projects = await window.evaluate(() => globalThis.window.electron.project.list())
      return projects.map((project) => project.id)
    }).toContain('legacy-project-1')

    const migrated = await window.evaluate(() =>
      globalThis.window.electron.terminal.loadPaneTree('legacy-project-1')
    )
    expect(migrated).not.toBeNull()

    const storeFile = path.join(testDataDir, 'multiclaude-data.json')
    const content = JSON.parse(fs.readFileSync(storeFile, 'utf8'))

    const layout = content.terminalLayouts?.['legacy-project-1']
    expect(layout).toBeDefined()
    expect(layout.schemaVersion).toBe(2)
    expect(layout.paneTree).toEqual(migrated)
    expect(collectLeafIds(layout.paneTree).sort()).toEqual([
      'legacy-t-a',
      'legacy-t-b',
      'legacy-t-c'
    ])
    // Legacy terminals array preserved for safety
    expect(Array.isArray(layout.terminals)).toBe(true)
    expect(layout.terminals.length).toBe(3)
  })
})
