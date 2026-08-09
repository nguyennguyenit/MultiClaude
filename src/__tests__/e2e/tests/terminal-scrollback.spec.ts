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
    for (let step = 0; step < 10; step += 1) {
      await window.keyboard.press('Shift+PageUp')
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
