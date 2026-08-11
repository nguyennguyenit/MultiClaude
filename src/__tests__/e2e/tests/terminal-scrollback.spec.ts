import type { Page } from '@playwright/test'
import { test, expect, injectMockProject, addTerminal, WAIT_TIMES } from '../fixtures'
import { mockProjects } from '../fixtures/test-data'

interface TerminalDebugSnapshot {
  baseY: number
  viewportY: number
  savedViewportY: number | null
  isAtBottom: boolean
  readingViewportIntent: { viewportY: number | null; stickToBottom: boolean } | null
}

async function getActiveTerminalId(page: Page): Promise<string | null> {
  return page.evaluate(() => {
    const appStore = (window as typeof window & {
      __APP_STORE__?: { getState: () => { activeTerminalId: string | null } }
    }).__APP_STORE__
    return appStore?.getState().activeTerminalId ?? null
  })
}

async function getTerminalDebugSnapshot(
  page: Page,
  terminalId: string,
): Promise<TerminalDebugSnapshot | null> {
  return page.evaluate((id) => {
    const debugWindow = window as typeof window & {
      __TERMINAL_DEBUG__?: Record<string, { getSnapshot: () => TerminalDebugSnapshot }>
    }
    return debugWindow.__TERMINAL_DEBUG__?.[id]?.getSnapshot() ?? null
  }, terminalId)
}

test.describe('Terminal Scrollback', () => {
  test('keeps the custom scrollbar thumb synchronized with top, bottom, and pointer drag', async ({ window }) => {
    const [project] = mockProjects
    await injectMockProject(window, [project])
    await window.waitForTimeout(WAIT_TIMES.STANDARD)
    await addTerminal(window)

    const terminalId = await getActiveTerminalId(window)
    expect(terminalId).toBeTruthy()
    if (!terminalId) throw new Error('Expected an active terminal')

    await window.waitForSelector(`[data-terminal-id="${terminalId}"] .xterm-scrollable-element`)
    await window.evaluate((id) => {
      const appWindow = window as typeof window & {
        electron: { terminal: { write: (terminalId: string, data: string) => void } }
      }
      const command = navigator.userAgent.includes('Windows')
        ? 'powershell -NoProfile -Command "1..1000"\r'
        : 'seq 1 1000\n'
      appWindow.electron.terminal.write(id, command)
    }, terminalId)

    await expect.poll(async () => {
      return (await getTerminalDebugSnapshot(window, terminalId))?.baseY ?? 0
    }, { timeout: 5_000 }).toBeGreaterThan(700)

    const scrollbar = window.locator(
      `[data-terminal-id="${terminalId}"] .xterm-scrollable-element > .scrollbar.vertical`
    )
    const thumb = scrollbar.locator('.slider')
    await expect(thumb).toBeVisible()

    await window.getByRole('button', { name: 'Scroll to top' }).click()
    await expect.poll(async () => {
      return (await getTerminalDebugSnapshot(window, terminalId))?.viewportY
    }).toBe(0)

    const topTrackBox = await scrollbar.boundingBox()
    const topThumbBox = await thumb.boundingBox()
    expect(topTrackBox).not.toBeNull()
    expect(topThumbBox).not.toBeNull()
    expect(Math.abs((topThumbBox?.y ?? 0) - (topTrackBox?.y ?? 0))).toBeLessThan(2)

    await window.getByRole('button', { name: 'Scroll to bottom' }).click()
    const bottomSnapshot = await getTerminalDebugSnapshot(window, terminalId)
    expect(bottomSnapshot?.viewportY).toBe(bottomSnapshot?.baseY)

    await expect.poll(async () => {
      const trackBox = await scrollbar.boundingBox()
      const thumbBox = await thumb.boundingBox()
      if (!trackBox || !thumbBox) return Number.POSITIVE_INFINITY
      return Math.abs(
        (thumbBox.y + thumbBox.height) - (trackBox.y + trackBox.height)
      )
    }).toBeLessThan(2)

    const bottomTrackBox = await scrollbar.boundingBox()
    const bottomThumbBox = await thumb.boundingBox()

    if (!bottomTrackBox || !bottomThumbBox) throw new Error('Expected scrollbar geometry')
    const pointerX = bottomThumbBox.x + bottomThumbBox.width / 2
    await window.mouse.move(pointerX, bottomThumbBox.y + bottomThumbBox.height / 2)
    await window.mouse.down()
    await window.mouse.move(pointerX, bottomTrackBox.y + bottomThumbBox.height / 2, { steps: 8 })
    await window.mouse.up()

    await expect.poll(async () => {
      return (await getTerminalDebugSnapshot(window, terminalId))?.viewportY
    }).toBe(0)
    const draggedThumbBox = await thumb.boundingBox()
    expect(draggedThumbBox).not.toBeNull()
    expect(Math.abs((draggedThumbBox?.y ?? 0) - bottomTrackBox.y)).toBeLessThan(2)
  })

  test('keeps the reading position while the active terminal streams output', async ({ window }) => {
    const [project] = mockProjects
    await injectMockProject(window, [project])
    await window.waitForTimeout(WAIT_TIMES.STANDARD)
    await addTerminal(window)

    const terminalId = await getActiveTerminalId(window)
    expect(terminalId).toBeTruthy()
    if (!terminalId) throw new Error('Expected an active terminal')

    await window.waitForSelector(`[data-terminal-id="${terminalId}"] .xterm-scrollable-element`)
    await window.evaluate((id) => {
      const appWindow = window as typeof window & {
        electron: { terminal: { write: (terminalId: string, data: string) => void } }
      }
      const command = navigator.userAgent.includes('Windows')
        ? `powershell -NoProfile -Command "1..240; Start-Sleep -Seconds 10; [Console]::Write([char]27 + '[?2026h' + [char]27 + '[2J'); 241..520; [Console]::Write([char]27 + '[?2026l')"\r`
        : "seq 1 240; sleep 10; printf '\\033[?2026h\\033[2J'; seq 241 520; printf '\\033[?2026l'\n"
      appWindow.electron.terminal.write(id, command)
    }, terminalId)

    await expect.poll(async () => {
      return (await getTerminalDebugSnapshot(window, terminalId))?.baseY ?? 0
    }, { timeout: 5_000 }).toBeGreaterThan(150)

    const terminalInput = window.locator(
      `[data-terminal-id="${terminalId}"] .xterm-helper-textarea`
    )
    await terminalInput.focus()
    for (let step = 0; step < 30; step += 1) {
      const previousViewportY = (await getTerminalDebugSnapshot(window, terminalId))?.viewportY
      if (previousViewportY === 0) break
      await window.keyboard.press('Shift+PageUp')
      await expect.poll(async () => {
        return (await getTerminalDebugSnapshot(window, terminalId))?.viewportY ?? previousViewportY
      }).toBeLessThan(previousViewportY ?? Number.POSITIVE_INFINITY)
    }
    await expect.poll(async () => {
      return (await getTerminalDebugSnapshot(window, terminalId))?.viewportY
    }).toBe(0)

    const beforeLiveOutput = await getTerminalDebugSnapshot(window, terminalId)
    expect(beforeLiveOutput).not.toBeNull()
    expect(beforeLiveOutput?.readingViewportIntent).toEqual({
      viewportY: 0,
      stickToBottom: false,
    })

    await expect.poll(async () => {
      return (await getTerminalDebugSnapshot(window, terminalId))?.baseY ?? 0
    }, { timeout: 15_000 }).toBeGreaterThan((beforeLiveOutput?.baseY ?? 0) + 100)

    const afterLiveOutput = await getTerminalDebugSnapshot(window, terminalId)
    expect(afterLiveOutput, JSON.stringify(afterLiveOutput)).toMatchObject({
      viewportY: 0,
      savedViewportY: 0,
      isAtBottom: false,
    })
  })
})
