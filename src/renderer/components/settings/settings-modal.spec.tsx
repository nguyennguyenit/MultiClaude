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

describe('SettingsModal — Mobile tab integration (v3.4.0 regression)', () => {
  it('renders 5 tabs including Mobile between Notifications and Updates', async () => {
    render(<SettingsModal isOpen={true} onClose={() => undefined} />)

    const appearance = await screen.findByTestId('settings-tab-appearance')
    const terminals = screen.getByTestId('settings-tab-terminals')
    const notifications = screen.getByTestId('settings-tab-notifications')
    const mobile = screen.getByTestId('settings-tab-mobile-control')
    const updates = screen.getByTestId('settings-tab-updates')

    expect(appearance).toBeTruthy()
    expect(terminals).toBeTruthy()
    expect(notifications).toBeTruthy()
    expect(mobile).toBeTruthy()
    expect(updates).toBeTruthy()

    // Verify DOM order: notifications → mobile → updates
    const sidebar = screen.getByTestId('settings-sidebar')
    const buttons = Array.from(sidebar.querySelectorAll('[data-testid^="settings-tab-"]'))
    const ids = buttons.map((b) => b.getAttribute('data-testid'))
    expect(ids).toEqual([
      'settings-tab-appearance',
      'settings-tab-terminals',
      'settings-tab-notifications',
      'settings-tab-mobile-control',
      'settings-tab-updates'
    ])
  })

  it('clicking Mobile tab renders MobileControlSettings body', async () => {
    render(<SettingsModal isOpen={true} onClose={() => undefined} />)
    const mobileTab = await screen.findByTestId('settings-tab-mobile-control')
    fireEvent.click(mobileTab)
    await waitFor(() => {
      // SettingsTitle text rendered inside MobileControlSettings
      expect(screen.getByText('Mobile Control')).toBeTruthy()
      expect(screen.getByTestId('mc-toggle')).toBeTruthy()
    })
  })

  it('default active tab remains appearance (does not accidentally default to mobile)', async () => {
    render(<SettingsModal isOpen={true} onClose={() => undefined} />)
    await screen.findByTestId('settings-tab-appearance')
    // MobileControlSettings body not mounted yet
    expect(screen.queryByTestId('mc-toggle')).toBeNull()
  })
})
