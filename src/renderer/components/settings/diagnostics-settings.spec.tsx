// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { DEFAULT_NOTIFICATION_SETTINGS } from '@shared/constants'
import { useNotificationStore } from '../../stores/notification-store'
import { DiagnosticsSettings } from './diagnostics-settings'

const getDiagnostics = vi.fn()

beforeEach(() => {
  getDiagnostics.mockReset().mockResolvedValue([{
    terminalId: 'term-safe-id',
    provider: 'codex',
    engine: 'xterm',
    backend: 'xterm-headless',
    backendAvailable: true,
    lastSequence: 41,
    watermark: 40,
    fallbackReason: null,
  }])
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
})

describe('DiagnosticsSettings terminal metadata', () => {
  it('renders provider, engine/backend, sequence/watermark, and fallback without transcript content', async () => {
    render(<DiagnosticsSettings />)

    expect(await screen.findByText('codex')).toBeTruthy()
    expect(screen.getByText('xterm / xterm-headless (available)')).toBeTruthy()
    expect(screen.getByText('41 / 40')).toBeTruthy()
    expect(screen.getByText('none')).toBeTruthy()
    expect(document.body.textContent).not.toContain('transcript')

    fireEvent.click(screen.getByRole('button', { name: 'Refresh' }))
    await waitFor(() => expect(getDiagnostics).toHaveBeenCalledTimes(2))
  })

  it('fails closed when runtime diagnostics are unavailable', async () => {
    getDiagnostics.mockRejectedValueOnce(new Error('unavailable'))
    render(<DiagnosticsSettings />)
    expect(await screen.findByText('Terminal diagnostics are unavailable.')).toBeTruthy()
  })
})
