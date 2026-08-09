// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, fireEvent, screen, waitFor } from '@testing-library/react'
import { SettingsModal } from './settings-modal'
import { useNotificationStore } from '../../stores/notification-store'
import { DEFAULT_NOTIFICATION_SETTINGS } from '@shared/constants'
import type { MobileControlStatus } from '@main/notification/mobile-control-manager'

interface MobileControlApi {
  getStatus: ReturnType<typeof vi.fn>
  enable: ReturnType<typeof vi.fn>
  disable: ReturnType<typeof vi.fn>
  regenerateSecret: ReturnType<typeof vi.fn>
  onStatusChanged: ReturnType<typeof vi.fn>
}

interface NotificationApi {
  getSettings: ReturnType<typeof vi.fn>
  updateSettings: ReturnType<typeof vi.fn>
  setTelegram: ReturnType<typeof vi.fn>
  clearTelegram: ReturnType<typeof vi.fn>
  setDiscord: ReturnType<typeof vi.fn>
  clearDiscord: ReturnType<typeof vi.fn>
}

function makeMcStatus(overrides: Partial<MobileControlStatus> = {}): MobileControlStatus {
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
  const mobile: MobileControlApi = {
    getStatus: vi.fn().mockResolvedValue(makeMcStatus()),
    enable: vi.fn().mockResolvedValue(makeMcStatus()),
    disable: vi.fn().mockResolvedValue(makeMcStatus()),
    regenerateSecret: vi.fn().mockResolvedValue(makeMcStatus()),
    onStatusChanged: vi.fn().mockReturnValue(() => undefined)
  }
  const notification: NotificationApi = {
    getSettings: vi.fn().mockResolvedValue(DEFAULT_NOTIFICATION_SETTINGS),
    updateSettings: vi.fn().mockResolvedValue(DEFAULT_NOTIFICATION_SETTINGS),
    setTelegram: vi.fn().mockResolvedValue(undefined),
    clearTelegram: vi.fn().mockResolvedValue(undefined),
    setDiscord: vi.fn().mockResolvedValue(undefined),
    clearDiscord: vi.fn().mockResolvedValue(undefined)
  }
  Object.defineProperty(window, 'electron', {
    writable: true,
    configurable: true,
    value: { mobileControl: mobile, notification }
  })
  useNotificationStore.setState({
    savedSettings: DEFAULT_NOTIFICATION_SETTINGS,
    pendingSettings: DEFAULT_NOTIFICATION_SETTINGS,
    hasUnsavedChanges: false,
    isLoading: false,
    remoteControlStatus: 'disconnected'
  })
})

describe('SettingsModal — settings ownership', () => {
  it('renders Diagnostics and Agents & Integrations as explicit tabs', async () => {
    render(<SettingsModal isOpen={true} onClose={() => undefined} />)

    const appearance = await screen.findByTestId('settings-tab-appearance')
    const terminals = screen.getByTestId('settings-tab-terminals')
    const notifications = screen.getByTestId('settings-tab-notifications')
    const diagnostics = screen.getByTestId('settings-tab-diagnostics')
    const agents = screen.getByTestId('settings-tab-agents-integrations')
    const updates = screen.getByTestId('settings-tab-updates')

    expect(appearance).toBeTruthy()
    expect(terminals).toBeTruthy()
    expect(notifications).toBeTruthy()
    expect(diagnostics).toBeTruthy()
    expect(agents).toBeTruthy()
    expect(updates).toBeTruthy()

    // Verify DOM order: notifications → mobile → updates
    const sidebar = screen.getByTestId('settings-sidebar')
    const buttons = Array.from(sidebar.querySelectorAll('[data-testid^="settings-tab-"]'))
    const ids = buttons.map((b) => b.getAttribute('data-testid'))
    expect(ids).toEqual([
      'settings-tab-appearance',
      'settings-tab-terminals',
      'settings-tab-notifications',
      'settings-tab-diagnostics',
      'settings-tab-agents-integrations',
      'settings-tab-updates'
    ])
  })

  it('clicking Agents & Integrations renders MobileControlSettings body', async () => {
    render(<SettingsModal isOpen={true} onClose={() => undefined} />)
    const agentsTab = await screen.findByTestId('settings-tab-agents-integrations')
    fireEvent.click(agentsTab)
    await waitFor(() => {
      // SettingsTitle text rendered inside MobileControlSettings
      expect(screen.getByText('Mobile Control')).toBeTruthy()
      expect(screen.getByText('Telegram')).toBeTruthy()
      expect(screen.getByText('Discord')).toBeTruthy()
      expect(screen.getByTestId('mc-toggle')).toBeTruthy()
    })
  })

  it('keeps provider controls out of Notifications', async () => {
    render(<SettingsModal isOpen={true} onClose={() => undefined} />)
    fireEvent.click(await screen.findByTestId('settings-tab-notifications'))

    expect(await screen.findByText('On Task Complete')).toBeTruthy()
    expect(screen.queryByText('Detection Mode')).toBeNull()
    expect(screen.queryByText('Telegram')).toBeNull()
    expect(screen.queryByText('Discord')).toBeNull()
  })

  it('clicking Diagnostics renders parser overrides outside Notifications', async () => {
    render(<SettingsModal isOpen={true} onClose={() => undefined} />)
    const diagnosticsTab = await screen.findByTestId('settings-tab-diagnostics')
    fireEvent.click(diagnosticsTab)
    expect(await screen.findByText('Detection Mode')).toBeTruthy()
  })

  it('default active tab remains appearance', async () => {
    render(<SettingsModal isOpen={true} onClose={() => undefined} />)
    await screen.findByTestId('settings-tab-appearance')
    // MobileControlSettings body not mounted yet
    expect(screen.queryByTestId('mc-toggle')).toBeNull()
  })

  it('traps focus and restores the previously focused control on close', async () => {
    const opener = document.createElement('button')
    document.body.appendChild(opener)
    opener.focus()
    const view = render(<SettingsModal isOpen={true} onClose={() => undefined} />)
    const close = await screen.findByLabelText('Close Settings')
    await waitFor(() => expect(document.activeElement).toBe(close))

    const modal = screen.getByTestId('settings-modal')
    const focusable = modal.querySelectorAll<HTMLElement>(
      'button:not(:disabled), select:not(:disabled), input:not(:disabled), [tabindex]:not([tabindex="-1"])'
    )
    fireEvent.keyDown(window, { key: 'Tab', shiftKey: true })
    expect(document.activeElement).toBe(focusable[focusable.length - 1])

    view.rerender(<SettingsModal isOpen={false} onClose={() => undefined} />)
    expect(document.activeElement).toBe(opener)
    opener.remove()
  })
})
