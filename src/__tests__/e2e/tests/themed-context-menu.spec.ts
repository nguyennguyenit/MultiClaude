import { test, expect, injectMockProject, addTerminal, WAIT_TIMES } from '../fixtures'
import { mockProject } from '../fixtures/test-data'

const isCI = process.env.CI === 'true'

test.describe('Themed Context Menu', () => {
  test.skip(isCI, 'Requires PTY for terminal creation')

  test.beforeEach(async ({ window }) => {
    await injectMockProject(window, [mockProject])
    await window.waitForSelector('#root', { state: 'attached' })
    await window.waitForTimeout(WAIT_TIMES.LONG)
  })

  test('right-click on terminal opens themed menu with Paste item', async ({ window }) => {
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
    await expect(menu.getByText('Paste')).toBeVisible()
  })

  test('Escape closes the menu', async ({ window }) => {
    const count = await window.locator('[data-terminal-id]').count()
    if (count === 0) {
      await addTerminal(window)
      await window.waitForSelector('[data-terminal-id]', { timeout: 5000 })
    }

    const pane = window.locator('[data-terminal-id]').first()
    await pane.click({ button: 'right' })
    await window.waitForTimeout(WAIT_TIMES.SHORT)
    await window.keyboard.press('Escape')
    await window.waitForTimeout(WAIT_TIMES.SHORT)

    const menu = window.locator('[role="menu"]')
    await expect(menu).toHaveCount(0)
  })

  test('menu background matches --bg-primary CSS variable', async ({ window }) => {
    const count = await window.locator('[data-terminal-id]').count()
    if (count === 0) {
      await addTerminal(window)
      await window.waitForSelector('[data-terminal-id]', { timeout: 5000 })
    }

    const pane = window.locator('[data-terminal-id]').first()
    await pane.click({ button: 'right' })
    await window.waitForTimeout(WAIT_TIMES.SHORT)

    const result = await window.evaluate(() => {
      const menu = document.querySelector('[role="menu"]') as HTMLElement | null
      const root = document.documentElement
      if (!menu) return null
      return {
        menuBg: getComputedStyle(menu).backgroundColor,
        cssVarBg: getComputedStyle(root).getPropertyValue('--bg-primary').trim()
      }
    })

    expect(result).not.toBeNull()
    expect(result?.menuBg).toBeTruthy()
    expect(result?.cssVarBg).toBeTruthy()
  })
})
