// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, fireEvent, screen, waitFor } from '@testing-library/react'
import { MobileControlSettings } from './mobile-control-settings'

interface MobileControlApi {
  getStatus: ReturnType<typeof vi.fn>
  enable: ReturnType<typeof vi.fn>
  disable: ReturnType<typeof vi.fn>
  regenerateSecret: ReturnType<typeof vi.fn>
  onStatusChanged: ReturnType<typeof vi.fn>
}

function makeStatus(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    enabled: false,
    running: false,
    port: null,
    secretFingerprint: null,
    installStatus: { installed: false, eventCount: 0 },
    ccpokeDetected: false,
    ccpokeReasons: [],
    ...overrides
  }
}

beforeEach(() => {
  const api: MobileControlApi = {
    getStatus: vi.fn().mockResolvedValue(makeStatus()),
    enable: vi.fn().mockResolvedValue(makeStatus({ running: true, port: 14321, secretFingerprint: 'a1b2c3d4', installStatus: { installed: true, eventCount: 3 } })),
    disable: vi.fn().mockResolvedValue(makeStatus()),
    regenerateSecret: vi.fn().mockResolvedValue(makeStatus({ running: true, port: 14321, secretFingerprint: 'z9y8x7w6', installStatus: { installed: true, eventCount: 3 } })),
    onStatusChanged: vi.fn().mockReturnValue(() => undefined)
  }
  Object.defineProperty(window, 'electron', {
    writable: true,
    configurable: true,
    value: { mobileControl: api }
  })
})

describe('MobileControlSettings', () => {
  it('renders title and toggle in default state', async () => {
    render(<MobileControlSettings />)
    expect(await screen.findByText('Mobile Control')).toBeTruthy()
    expect(screen.getByTestId('mc-toggle')).toBeTruthy()
  })

  it('enable → shows status card with port + fingerprint', async () => {
    render(<MobileControlSettings />)
    const toggle = await screen.findByTestId('mc-toggle').then((el) => el.querySelector('button') as HTMLButtonElement)
    fireEvent.click(toggle)
    await waitFor(() => {
      expect(screen.getByTestId('mc-status-card')).toBeTruthy()
    })
    expect(screen.getByTestId('mc-status-card').textContent).toContain('14321')
    expect(screen.getByTestId('mc-status-card').textContent).toContain('a1b2c3d4')
  })

  it('disable → hides status card', async () => {
    const electron = window.electron as unknown as { mobileControl: MobileControlApi }
    electron.mobileControl.getStatus = vi.fn().mockResolvedValue(makeStatus({ running: true, port: 1, secretFingerprint: 'fp', installStatus: { installed: true, eventCount: 3 } }))
    render(<MobileControlSettings />)
    const toggle = await screen.findByTestId('mc-toggle').then((el) => el.querySelector('button') as HTMLButtonElement)
    await waitFor(() => expect(screen.queryByTestId('mc-status-card')).toBeTruthy())
    fireEvent.click(toggle)
    await waitFor(() => {
      expect(screen.queryByTestId('mc-status-card')).toBeNull()
    })
  })

  it('error is displayed when enable fails', async () => {
    const electron = window.electron as unknown as { mobileControl: MobileControlApi }
    electron.mobileControl.enable = vi.fn().mockResolvedValue(makeStatus({ error: 'Port conflict' }))
    render(<MobileControlSettings />)
    const toggle = await screen.findByTestId('mc-toggle').then((el) => el.querySelector('button') as HTMLButtonElement)
    fireEvent.click(toggle)
    await waitFor(() => {
      expect(screen.getByTestId('mc-error').textContent).toContain('Port conflict')
    })
  })

  it('shows ccpoke warning when detected', async () => {
    const electron = window.electron as unknown as { mobileControl: MobileControlApi }
    electron.mobileControl.getStatus = vi.fn().mockResolvedValue(makeStatus({
      running: true,
      port: 1,
      secretFingerprint: 'fp',
      installStatus: { installed: true, eventCount: 3 },
      ccpokeDetected: true,
      ccpokeReasons: ['hooks/opencode-notify.js (filename match)']
    }))
    render(<MobileControlSettings />)
    await waitFor(() => {
      expect(screen.getByTestId('mc-ccpoke-warning').textContent).toContain('opencode-notify')
    })
  })

  it('regenerate secret shows confirm dialog and rotates on confirm', async () => {
    const electron = window.electron as unknown as { mobileControl: MobileControlApi }
    electron.mobileControl.getStatus = vi.fn().mockResolvedValue(makeStatus({
      running: true,
      port: 1,
      secretFingerprint: 'old-fp',
      installStatus: { installed: true, eventCount: 3 }
    }))
    render(<MobileControlSettings />)
    const regen = await screen.findByTestId('mc-regen-secret')
    fireEvent.click(regen)
    expect(screen.getByTestId('mc-regen-confirm')).toBeTruthy()
    fireEvent.click(screen.getByText('Regenerate'))
    await waitFor(() => {
      expect(screen.getByTestId('mc-status-card').textContent).toContain('z9y8x7w6')
    })
  })
})
