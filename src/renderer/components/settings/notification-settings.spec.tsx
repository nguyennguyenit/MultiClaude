// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, fireEvent, screen, waitFor, act } from '@testing-library/react'
import { NotificationSettings } from './notification-settings'
import { useNotificationStore } from '../../stores/notification-store'
import { DEFAULT_NOTIFICATION_SETTINGS } from '@shared/constants'
import type { NotificationSettings as NotificationSettingsType, RemoteControlStatus } from '@shared/types'
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

function makeStatus(overrides: Partial<MobileControlStatus> = {}): MobileControlStatus {
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

function seedStore(overrides: Partial<NotificationSettingsType> = {}) {
  const seeded: NotificationSettingsType = { ...DEFAULT_NOTIFICATION_SETTINGS, ...overrides }
  useNotificationStore.setState({
    savedSettings: seeded,
    pendingSettings: seeded,
    hasUnsavedChanges: false,
    isLoading: false,
    remoteControlStatus: 'disconnected' as RemoteControlStatus
  })
}

beforeEach(() => {
  const mobile: MobileControlApi = {
    getStatus: vi.fn().mockResolvedValue(makeStatus()),
    enable: vi.fn().mockResolvedValue(makeStatus()),
    disable: vi.fn().mockResolvedValue(makeStatus()),
    regenerateSecret: vi.fn().mockResolvedValue(makeStatus()),
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
})

describe('NotificationSettings — mobile-control hint', () => {
  it('renders the hint when mobile control is NOT running and Review Needed is ON', async () => {
    seedStore({ onReviewNeeded: true })
    render(<NotificationSettings onNavigateToMobile={() => {}} />)
    const hint = await screen.findByTestId('mobile-control-hint')
    expect(hint.textContent).toContain('enable Mobile Control')
  })

  it('hides the hint when mobile control IS running', async () => {
    const electron = window.electron as unknown as { mobileControl: MobileControlApi }
    electron.mobileControl.getStatus = vi.fn().mockResolvedValue(
      makeStatus({ running: true, port: 14321, secretFingerprint: 'fp', installStatus: { installed: true, eventCount: 1 } })
    )
    seedStore({ onReviewNeeded: true })
    render(<NotificationSettings onNavigateToMobile={() => {}} />)
    await waitFor(() => {
      expect(screen.queryByTestId('mobile-control-hint')).toBeNull()
    })
  })

  it('hides the hint when Review Needed is OFF (even if mobile control is off)', async () => {
    seedStore({ onReviewNeeded: false })
    render(<NotificationSettings onNavigateToMobile={() => {}} />)
    // Wait one tick so the getStatus promise resolves.
    await waitFor(() => {
      expect(screen.queryByTestId('mobile-control-hint')).toBeNull()
    })
  })

  it('clicking the link invokes onNavigateToMobile', async () => {
    const onNavigate = vi.fn()
    seedStore({ onReviewNeeded: true })
    render(<NotificationSettings onNavigateToMobile={onNavigate} />)
    const link = await screen.findByRole('button', { name: /enable Mobile Control/i })
    fireEvent.click(link)
    expect(onNavigate).toHaveBeenCalledTimes(1)
  })

  it('re-hides the hint when a status-changed event reports running=true', async () => {
    seedStore({ onReviewNeeded: true })
    let statusCallback: ((s: MobileControlStatus) => void) | null = null
    const electron = window.electron as unknown as { mobileControl: MobileControlApi }
    electron.mobileControl.onStatusChanged = vi.fn((cb: (s: MobileControlStatus) => void) => {
      statusCallback = cb
      return () => undefined
    })
    render(<NotificationSettings onNavigateToMobile={() => {}} />)
    await screen.findByTestId('mobile-control-hint')

    act(() => {
      statusCallback?.(makeStatus({ running: true }))
    })
    await waitFor(() => {
      expect(screen.queryByTestId('mobile-control-hint')).toBeNull()
    })
  })
})
