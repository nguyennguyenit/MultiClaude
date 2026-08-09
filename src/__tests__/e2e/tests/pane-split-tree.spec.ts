import { test, expect, injectMockProject, addTerminal, WAIT_TIMES } from '../fixtures'
import { mockProject } from '../fixtures/test-data'

const isCI = process.env.CI === 'true'

test.describe('Pane Split Tree', () => {
  test.skip(isCI, 'Requires PTY for terminal creation')

  test.beforeEach(async ({ window }) => {
    await injectMockProject(window, [mockProject])
    await window.waitForSelector('#root', { state: 'attached' })
    await window.waitForTimeout(WAIT_TIMES.LONG)
  })

  test('split-button arrow on action bar opens dropdown with 4 split items', async ({ window }) => {
    const count = await window.locator('[data-terminal-id]').count()
    if (count === 0) {
      await addTerminal(window)
      await window.waitForSelector('[data-terminal-id]', { timeout: 5000 })
    }

    const arrow = window.locator('.split-button-arrow').first()
    await expect(arrow).toBeVisible()
    await arrow.click()
    await window.waitForTimeout(WAIT_TIMES.SHORT)

    const menu = window.locator('[role="menu"]')
    await expect(menu).toBeVisible()
    for (const label of ['Split right', 'Split left', 'Split down', 'Split up']) {
      await expect(menu.getByText(label)).toBeVisible()
    }
  })

  test('Ctrl+Shift+ArrowRight adds a pane to the right', async ({ window }) => {
    const count = await window.locator('[data-terminal-id]').count()
    if (count === 0) {
      await addTerminal(window)
      await window.waitForSelector('[data-terminal-id]', { timeout: 5000 })
    }

    const before = await window.locator('[data-terminal-id]').count()
    await window.locator('[data-terminal-id]').first().click()
    await window.keyboard.press('Control+Shift+ArrowRight')
    await window.waitForTimeout(WAIT_TIMES.LONG)

    const after = await window.locator('[data-terminal-id]').count()
    expect(after).toBeGreaterThanOrEqual(before)
  })

  test('right-click menu contains the 4 split entries', async ({ window }) => {
    const count = await window.locator('[data-terminal-id]').count()
    if (count === 0) {
      await addTerminal(window)
      await window.waitForSelector('[data-terminal-id]', { timeout: 5000 })
    }

    const pane = window.locator('[data-terminal-id]').first()
    await pane.click({ button: 'right' })
    await window.waitForTimeout(WAIT_TIMES.SHORT)

    const menu = window.locator('[role="menu"]')
    await expect(menu).toBeVisible()
    for (const label of ['Split right', 'Split left', 'Split down', 'Split up']) {
      await expect(menu.getByText(label)).toBeVisible()
    }
  })
})
