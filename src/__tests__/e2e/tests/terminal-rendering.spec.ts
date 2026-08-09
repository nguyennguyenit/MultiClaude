import type { Page } from '@playwright/test'
import { test, expect, injectMockProject, addTerminal, WAIT_TIMES } from '../fixtures'
import {
  activateTerminalPane,
  openRendererDiagnostics,
  readVisibleRendererStatus,
  selectRendererPolicy,
} from '../fixtures/electron-app'
import { mockProject } from '../fixtures/test-data'

// PTY-backed renderer evidence must run on a desktop host. A CI skip is not release evidence.
const isCI = process.env['CI'] === 'true'

async function firstTerminalId(window: Page): Promise<string> {
  const pane = window.locator('[data-terminal-id]').first()
  await expect(pane).toBeVisible()
  const terminalId = await pane.getAttribute('data-terminal-id')
  if (!terminalId) throw new Error('Visible terminal is missing its public terminal ID')
  return terminalId
}

async function writeMarker(window: Page, terminalId: string, marker: string): Promise<void> {
  const characterCodes = [...marker].map(character => character.charCodeAt(0))
  const octal = characterCodes.map(code => `\\${code.toString(8).padStart(3, '0')}`).join('')
  await window.evaluate(({ id, windowsCommand, posixCommand }) => {
    globalThis.window.electron.terminal.write(
      id,
      navigator.userAgent.includes('Windows') ? windowsCommand : posixCommand,
    )
  }, {
    id: terminalId,
    windowsCommand: `powershell -NoProfile -Command "[Console]::WriteLine([char[]](${characterCodes.join(',')}))"\r`,
    posixCommand: `printf '${octal}\\n'\r`,
  })
}

async function waitForSnapshotMarker(window: Page, terminalId: string, marker: string): Promise<void> {
  await expect.poll(async () => window.evaluate(async ({ id, expected }) =>
    (await globalThis.window.electron.terminal.getSnapshot(id)).ansi.includes(expected),
  { id: terminalId, expected: marker }), { timeout: 10_000 }).toBe(true)
}

async function expectGpuEligibleStatus(window: Page, terminalId: string): Promise<void> {
  await expect.poll(async () =>
    (await readVisibleRendererStatus(window, terminalId)).effective
  ).toMatch(/^(WebGL|DOM)$/)

  const status = await readVisibleRendererStatus(window, terminalId)
  if (status.effective === 'WebGL') {
    expect(status.fallback).toBe('none')
    expect(status.retryVisible).toBe(false)
    return
  }

  expect([
    'WebGL is unavailable in this environment.',
    'WebGL could not start.',
    'WebGL context lost.',
  ]).toContain(status.fallback)
  expect(status.retryVisible).toBe(
    status.fallback === 'WebGL could not start.' || status.fallback === 'WebGL context lost.'
  )
}

test.describe('Terminal renderer policy', () => {
  test.skip(isCI, 'PTY-backed renderer evidence requires a desktop Electron environment')

  test.beforeEach(async ({ window }) => {
    await injectMockProject(window, [mockProject])
    await addTerminal(window)
    await window.waitForSelector('[data-terminal-id]', { timeout: 5_000 })
  })

  test('shows typed status across Automatic, Prefer GPU, and Compatibility', async ({ window }) => {
    const terminalId = await firstTerminalId(window)
    const markers = ['MC_POLICY_AUTOMATIC_913', 'MC_POLICY_GPU_913', 'MC_POLICY_DOM_913']
    await activateTerminalPane(window, terminalId)
    await writeMarker(window, terminalId, markers[0])
    await waitForSnapshotMarker(window, terminalId, markers[0])
    await openRendererDiagnostics(window)

    await expect(window.getByRole('radio', { name: 'Automatic (Recommended)', exact: true })).toBeChecked()
    await expectGpuEligibleStatus(window, terminalId)

    await window.evaluate((id: string) => {
      const appStore = (window as unknown as {
        __APP_STORE__?: {
          getState: () => { terminals: Array<Record<string, unknown>> }
          setState: (state: { terminals: Array<Record<string, unknown>> }) => void
        }
      }).__APP_STORE__
      const terminals = appStore?.getState().terminals ?? []
      appStore?.setState({
        terminals: terminals.map(terminal =>
          terminal.id === id ? { ...terminal, agentType: 'claude' } : terminal
        ),
      })
    }, terminalId)

    await expect.poll(async () => readVisibleRendererStatus(window, terminalId)).toMatchObject({
      effective: 'DOM',
      fallback: 'Automatic uses safer rendering for this agent.',
      retryVisible: false,
    })

    await selectRendererPolicy(window, 'Prefer GPU')
    await expectGpuEligibleStatus(window, terminalId)
    await writeMarker(window, terminalId, markers[1])
    await waitForSnapshotMarker(window, terminalId, markers[1])

    await selectRendererPolicy(window, 'Compatibility')
    await expect.poll(async () => readVisibleRendererStatus(window, terminalId)).toMatchObject({
      effective: 'DOM',
      fallback: 'Compatibility disables WebGL.',
      retryVisible: false,
    })
    await writeMarker(window, terminalId, markers[2])
    await waitForSnapshotMarker(window, terminalId, markers[2])

    await window.getByTestId('settings-save-button').click()
    const snapshot = await window.evaluate(async id =>
      (await globalThis.window.electron.terminal.getSnapshot(id)).ansi,
    terminalId)
    for (const marker of markers) {
      expect(snapshot.split(marker)).toHaveLength(2)
    }
    await window.locator(`[data-terminal-id="${terminalId}"] [aria-label="Close terminal"]`).click()
    await expect(window.locator(`[data-terminal-id="${terminalId}"]`)).toHaveCount(0)
    await openRendererDiagnostics(window)
    await expect(window.getByText(terminalId, { exact: true })).toHaveCount(0)
    await expect(window.getByText('No active terminals.', { exact: true })).toBeVisible()
  })

  test('sanitizes an unknown main fallback reason in the Electron surface', async ({ app, window }) => {
    const terminalId = await firstTerminalId(window)
    await app.evaluate(({ ipcMain }, id) => {
      ipcMain.removeHandler('terminal:get-diagnostics')
      ipcMain.handle('terminal:get-diagnostics', () => [{
        terminalId: id,
        provider: null,
        engine: 'xterm',
        backend: 'unavailable',
        backendAvailable: false,
        lastSequence: 0,
        watermark: 0,
        fallbackReason: 'SECRET raw GPU driver and command text',
      }])
    }, terminalId)

    await openRendererDiagnostics(window)
    await expect(window.getByText('Backend unavailable', { exact: true })).toBeVisible()
    await expect(window.getByText(/SECRET raw GPU driver/)).toHaveCount(0)
  })

  test('Compatibility persists and keeps Retry unavailable after reload', async ({ window }) => {
    const terminalId = await firstTerminalId(window)
    await activateTerminalPane(window, terminalId)
    await openRendererDiagnostics(window)
    await selectRendererPolicy(window, 'Compatibility')
    await window.getByTestId('settings-save-button').click()
    await expect(window.getByTestId('settings-modal')).not.toBeVisible()

    await window.reload()
    await window.waitForLoadState('domcontentloaded')
    await injectMockProject(window, [mockProject])
    await openRendererDiagnostics(window)

    await expect(window.getByRole('radio', { name: 'Compatibility', exact: true })).toBeChecked()
    const savedPolicy = await window.evaluate(async () =>
      (await globalThis.window.electron.settings.get()).terminalRendererPolicy
    )
    expect(savedPolicy).toBe('safe-dom')
    await expect(window.getByRole('button', { name: /Retry GPU/ })).toHaveCount(0)
  })

  test('retains unrelated max-terminal behavior', async ({ window }) => {
    await window.getByTestId('settings-button').click()
    await window.getByTestId('settings-tab-terminals').click()

    const limitLabel = window.getByText('Max Terminals per Project', { exact: true })
    await expect(limitLabel).toBeVisible()
    const preset4Button = window.getByRole('button', { name: '4', exact: true })
    await preset4Button.click()
    await expect(preset4Button).toHaveAttribute('aria-pressed', 'true')
    await window.getByTestId('settings-save-button').click()
    await window.waitForTimeout(WAIT_TIMES.SHORT)

    await expect(window.locator('[data-terminal-id]')).toHaveCount(1)
  })
})
