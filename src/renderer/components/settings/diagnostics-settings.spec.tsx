// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { DEFAULT_NOTIFICATION_SETTINGS, DEFAULT_SETTINGS } from '@shared/constants'
import { useAppStore } from '../../stores/app-store'
import { useNotificationStore } from '../../stores/notification-store'
import { useSettingsStore } from '../../stores/settings-store'
import {
  claimTerminalRendererSession,
  registerTerminalRendererRetry,
  resetTerminalRendererStatusStoreForTests,
  setTerminalRendererStatus,
} from '../../stores/terminal-renderer-status-store'
import { DiagnosticsSettings } from './diagnostics-settings'

const getDiagnostics = vi.fn()
const token = Symbol('diagnostics-session')

function liveTerminal(id = 'term-safe-id', agentType: 'generic' | 'claude' | 'codex' = 'generic') {
  return {
    id,
    title: 'SECRET terminal title',
    cwd: '/SECRET/private/path',
    isClaudeMode: false,
    agentType,
    createdAt: new Date(),
  }
}

function mainDiagnostic(terminalId = 'term-safe-id', fallbackReason: string | null = null) {
  return {
    terminalId,
    provider: 'codex' as const,
    engine: 'xterm' as const,
    backend: 'xterm-headless' as const,
    backendAvailable: true,
    lastSequence: 41,
    watermark: 40,
    fallbackReason,
  }
}

beforeEach(() => {
  getDiagnostics.mockReset().mockResolvedValue([mainDiagnostic()])
  Object.defineProperty(window, 'electron', {
    writable: true,
    configurable: true,
    value: { terminal: { getDiagnostics } },
  })
  useNotificationStore.setState({
    savedSettings: DEFAULT_NOTIFICATION_SETTINGS,
    pendingSettings: DEFAULT_NOTIFICATION_SETTINGS,
    hasUnsavedChanges: false,
    isLoading: false,
  })
  useSettingsStore.setState({
    settings: DEFAULT_SETTINGS,
    savedSettings: DEFAULT_SETTINGS,
    pendingSettings: DEFAULT_SETTINGS,
    hasUnsavedChanges: false,
  })
  useAppStore.setState({ terminals: [liveTerminal()] })
  resetTerminalRendererStatusStoreForTests()
  claimTerminalRendererSession('term-safe-id', token)
  setTerminalRendererStatus('term-safe-id', token, {
    effective: 'webgl',
    fallbackReason: null,
  })
})

describe('DiagnosticsSettings renderer policy', () => {
  it('renders an accessible canonical policy group with exact copy and updates pending state', async () => {
    render(<DiagnosticsSettings />)

    expect(screen.getByRole('radiogroup', { name: 'Terminal renderer policy' })).toBeTruthy()
    expect((screen.getByRole('radio', { name: 'Automatic (Recommended)' }) as HTMLInputElement).checked).toBe(true)
    expect(screen.getByText('WebGL for regular shells; safer non-WebGL rendering for Claude and Codex.')).toBeTruthy()
    expect(screen.getByText('Attempts WebGL for all terminals and falls back automatically.')).toBeTruthy()
    expect(screen.getByText('Disables WebGL for maximum compatibility.')).toBeTruthy()

    fireEvent.click(screen.getByRole('radio', { name: 'Compatibility' }))
    expect(useSettingsStore.getState().pendingSettings.terminalRendererPolicy).toBe('safe-dom')
    expect(useSettingsStore.getState().hasUnsavedChanges).toBe(true)
    await screen.findByText('WebGL')
  })

  it('joins main and renderer state from live terminal IDs and omits orphans and private labels', async () => {
    getDiagnostics.mockResolvedValue([
      mainDiagnostic(),
      mainDiagnostic('main-orphan'),
    ])
    claimTerminalRendererSession('renderer-orphan', Symbol('orphan'))
    render(<DiagnosticsSettings />)

    expect(await screen.findByText('xterm / xterm-headless (available)')).toBeTruthy()
    expect(screen.getByText('term-safe-id')).toBeTruthy()
    expect(screen.getByText('WebGL')).toBeTruthy()
    expect(document.body.textContent).not.toContain('main-orphan')
    expect(document.body.textContent).not.toContain('renderer-orphan')
    expect(document.body.textContent).not.toContain('SECRET')
    expect(screen.getByTestId('terminal-stream-diagnostics').getAttribute('data-renderer-registry-count')).toBe('2')
  })

  it('keeps local renderer status visible when the first main request fails', async () => {
    getDiagnostics.mockRejectedValueOnce(new Error('SECRET device failure'))
    setTerminalRendererStatus('term-safe-id', token, {
      effective: 'dom',
      fallbackReason: 'automatic-agent-safe',
    })
    render(<DiagnosticsSettings />)

    expect(await screen.findByText('Terminal diagnostics are unavailable.')).toBeTruthy()
    expect(screen.getByText('DOM')).toBeTruthy()
    expect(screen.getByText('Automatic uses safer rendering for this agent.')).toBeTruthy()
    expect(screen.getByText('Backend metadata unavailable')).toBeTruthy()
    expect(document.body.textContent).not.toContain('SECRET')
  })

  it('sanitizes unknown main fallback text and maps the known backend reason', async () => {
    getDiagnostics.mockResolvedValue([
      mainDiagnostic('term-safe-id', 'SECRET GPU and command text'),
    ])
    const view = render(<DiagnosticsSettings />)
    expect(await screen.findByText('Backend unavailable')).toBeTruthy()
    expect(document.body.textContent).not.toContain('SECRET')

    getDiagnostics.mockResolvedValue([
      mainDiagnostic('term-safe-id', 'Canonical xterm headless mirror unavailable.'),
    ])
    fireEvent.click(screen.getByRole('button', { name: 'Refresh' }))
    await waitFor(() => expect(screen.getByText('Canonical terminal mirror unavailable.')).toBeTruthy())
    view.unmount()
  })

  it('retries only the selected recoverable terminal while desired renderer is WebGL', async () => {
    const retry = vi.fn(() => true)
    setTerminalRendererStatus('term-safe-id', token, {
      effective: 'dom',
      fallbackReason: 'webgl-context-lost',
    })
    registerTerminalRendererRetry('term-safe-id', token, retry)
    render(<DiagnosticsSettings />)

    fireEvent.click(await screen.findByRole('button', { name: 'Retry GPU for term-safe-id' }))
    expect(retry).toHaveBeenCalledTimes(1)
    expect(useSettingsStore.getState().pendingSettings.terminalRendererPolicy).toBe('automatic')
  })

  it('hides Retry GPU under Compatibility and for non-recoverable reasons', async () => {
    useSettingsStore.setState({
      pendingSettings: { ...DEFAULT_SETTINGS, terminalRendererPolicy: 'safe-dom' },
    })
    setTerminalRendererStatus('term-safe-id', token, {
      effective: 'dom',
      fallbackReason: 'webgl-load-failed',
    })
    const view = render(<DiagnosticsSettings />)
    await screen.findByText('DOM')
    expect(screen.queryByRole('button', { name: /Retry GPU/ })).toBeNull()

    view.unmount()
    useSettingsStore.setState({
      pendingSettings: { ...DEFAULT_SETTINGS, terminalRendererPolicy: 'automatic' },
    })
    setTerminalRendererStatus('term-safe-id', token, {
      effective: 'dom',
      fallbackReason: 'automatic-agent-safe',
    })
    render(<DiagnosticsSettings />)
    await screen.findByText('DOM')
    expect(screen.queryByRole('button', { name: /Retry GPU/ })).toBeNull()
  })

  it('removes a diagnostics row when its live terminal closes', async () => {
    const view = render(<DiagnosticsSettings />)
    expect(await screen.findByText('term-safe-id')).toBeTruthy()

    act(() => { useAppStore.setState({ terminals: [] }) })
    await waitFor(() => expect(screen.queryByText('term-safe-id')).toBeNull())
    expect(screen.getByTestId('terminal-stream-diagnostics').getAttribute('data-renderer-registry-count')).toBe('1')
    view.unmount()
  })
})
