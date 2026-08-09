// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, fireEvent, screen, waitFor } from '@testing-library/react'
import { SettingsModal } from './settings-modal'
import { useSettingsStore } from '../../stores/settings-store'
import { useNotificationStore } from '../../stores/notification-store'
import { useToastStore } from '../../stores/toast-store'
import { DEFAULT_NOTIFICATION_SETTINGS, DEFAULT_SETTINGS } from '@shared/constants'
import type { MobileControlStatus } from '@main/notification/mobile-control-manager'

const initialSettingsState = useSettingsStore.getState()
const initialNotificationState = useNotificationStore.getState()

function deferred<T = void>() {
  let resolve!: (value: T | PromiseLike<T>) => void
  let reject!: (reason?: unknown) => void
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise
    reject = rejectPromise
  })
  return { promise, resolve, reject }
}

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
  useSettingsStore.setState(initialSettingsState, true)
  useNotificationStore.setState(initialNotificationState, true)
  useToastStore.setState({ toasts: [] })

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
    value: {
      mobileControl: mobile,
      notification,
      terminal: { getDiagnostics: vi.fn().mockResolvedValue([]) }
    }
  })
  useNotificationStore.setState({
    savedSettings: DEFAULT_NOTIFICATION_SETTINGS,
    pendingSettings: DEFAULT_NOTIFICATION_SETTINGS,
    hasUnsavedChanges: false,
    isLoading: false,
    remoteControlStatus: 'disconnected',
    loadSettings: vi.fn().mockResolvedValue(undefined)
  })
  useSettingsStore.setState({
    savedSettings: DEFAULT_SETTINGS,
    pendingSettings: DEFAULT_SETTINGS,
    settings: DEFAULT_SETTINGS,
    hasUnsavedChanges: false
  })
})

afterEach(() => {
  vi.restoreAllMocks()
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
    expect(screen.getByRole('radiogroup', { name: 'Terminal renderer policy' })).toBeTruthy()
  })

  it('makes a renderer policy edit dirty and Cancel restores the saved policy', async () => {
    const onClose = vi.fn()
    render(<SettingsModal isOpen={true} onClose={onClose} />)
    fireEvent.click(await screen.findByTestId('settings-tab-diagnostics'))
    await waitFor(() => expect(window.electron.terminal.getDiagnostics).toHaveBeenCalledTimes(1))

    fireEvent.click(screen.getByRole('radio', { name: 'Compatibility' }))
    expect(useSettingsStore.getState().pendingSettings.terminalRendererPolicy).toBe('safe-dom')
    expect(screen.getByTestId('settings-save-button')).toHaveProperty('disabled', false)

    fireEvent.click(screen.getByTestId('settings-cancel-button'))
    expect(useSettingsStore.getState().pendingSettings.terminalRendererPolicy).toBe('automatic')
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('prevents renderer policy edits after Save submission until settlement', async () => {
    const save = deferred()
    useSettingsStore.setState({ saveSettings: vi.fn(() => save.promise) })
    render(<SettingsModal isOpen={true} onClose={() => undefined} />)
    fireEvent.click(await screen.findByTestId('settings-tab-diagnostics'))
    await waitFor(() => expect(window.electron.terminal.getDiagnostics).toHaveBeenCalledTimes(1))
    fireEvent.click(screen.getByRole('radio', { name: 'Prefer GPU' }))

    fireEvent.click(screen.getByTestId('settings-save-button'))
    const compatibility = screen.getByRole('radio', { name: 'Compatibility' })
    expect(compatibility.matches(':disabled')).toBe(true)
    compatibility.click()
    expect(useSettingsStore.getState().pendingSettings.terminalRendererPolicy).toBe('prefer-gpu')

    save.resolve()
    await waitFor(() => expect(screen.getByTestId('settings-form')).toHaveProperty('disabled', false))
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

  it.each([
    ['Cancel', () => fireEvent.click(screen.getByTestId('settings-cancel-button'))],
    ['X', () => fireEvent.click(screen.getByTestId('settings-close-button'))],
    ['backdrop', () => fireEvent.click(screen.getByTestId('settings-backdrop'))],
    ['Escape', () => fireEvent.keyDown(window, { key: 'Escape' })]
  ])('rolls both pending snapshots back exactly once on %s', async (_name, dismiss) => {
    const cancelSettings = vi.fn()
    const cancelNotificationSettings = vi.fn()
    let view: ReturnType<typeof render>
    const onClose = vi.fn(() => {
      view.rerender(<SettingsModal isOpen={false} onClose={onClose} />)
    })
    useSettingsStore.setState({ cancelSettings })
    useNotificationStore.setState({ cancelSettings: cancelNotificationSettings })

    view = render(<SettingsModal isOpen={true} onClose={onClose} />)
    await screen.findByTestId('settings-modal')
    dismiss()

    expect(cancelSettings).toHaveBeenCalledTimes(1)
    expect(cancelNotificationSettings).toHaveBeenCalledTimes(1)
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('rolls both pending snapshots back once before an external close paints', async () => {
    const cancelSettings = vi.fn()
    const cancelNotificationSettings = vi.fn()
    const onClose = vi.fn()
    useSettingsStore.setState({ cancelSettings })
    useNotificationStore.setState({ cancelSettings: cancelNotificationSettings })
    const view = render(<SettingsModal isOpen={true} onClose={onClose} />)
    await screen.findByTestId('settings-modal')

    view.rerender(<SettingsModal isOpen={false} onClose={onClose} />)

    expect(screen.queryByTestId('settings-modal')).toBeNull()
    expect(cancelSettings).toHaveBeenCalledTimes(1)
    expect(cancelNotificationSettings).toHaveBeenCalledTimes(1)
    expect(onClose).not.toHaveBeenCalled()
  })

  it('locks the whole form and every modal-owned dismissal while saving', async () => {
    const save = deferred()
    const saveSettings = vi.fn(() => save.promise)
    const cancelSettings = vi.fn()
    const cancelNotificationSettings = vi.fn()
    const onClose = vi.fn()
    useSettingsStore.setState({ hasUnsavedChanges: true, saveSettings, cancelSettings })
    useNotificationStore.setState({ cancelSettings: cancelNotificationSettings })
    render(<SettingsModal isOpen={true} onClose={onClose} />)

    fireEvent.click(await screen.findByTestId('settings-save-button'))

    expect(screen.getByTestId('settings-form')).toHaveProperty('disabled', true)
    expect(screen.getByTestId('settings-close-button')).toHaveProperty('disabled', true)
    expect(screen.getByTestId('settings-cancel-button')).toHaveProperty('disabled', true)
    expect(screen.getByTestId('settings-tab-terminals').matches(':disabled')).toBe(true)

    fireEvent.click(screen.getByTestId('settings-backdrop'))
    fireEvent.click(screen.getByTestId('settings-close-button'))
    fireEvent.click(screen.getByTestId('settings-cancel-button'))
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(cancelSettings).not.toHaveBeenCalled()
    expect(cancelNotificationSettings).not.toHaveBeenCalled()
    expect(onClose).not.toHaveBeenCalled()

    save.resolve()
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1))
  })

  it('closes exactly once after a successful save', async () => {
    const onClose = vi.fn()
    const saveSettings = vi.fn().mockResolvedValue(undefined)
    useSettingsStore.setState({ hasUnsavedChanges: true, saveSettings })
    render(<SettingsModal isOpen={true} onClose={onClose} />)

    fireEvent.click(await screen.findByTestId('settings-save-button'))

    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1))
    expect(saveSettings).toHaveBeenCalledTimes(1)
  })

  it('stays locked until every parallel save settles after one rejects', async () => {
    const notificationSave = deferred()
    const addToast = vi.spyOn(useToastStore.getState(), 'addToast')
    useSettingsStore.setState({
      hasUnsavedChanges: true,
      saveSettings: vi.fn().mockRejectedValue(new Error('app save failed'))
    })
    useNotificationStore.setState({
      hasUnsavedChanges: true,
      saveSettings: vi.fn(() => notificationSave.promise)
    })
    render(<SettingsModal isOpen={true} onClose={() => undefined} />)

    fireEvent.click(await screen.findByTestId('settings-save-button'))
    await Promise.resolve()

    expect(screen.getByTestId('settings-form')).toHaveProperty('disabled', true)
    expect(addToast).not.toHaveBeenCalled()

    notificationSave.resolve()
    await waitFor(() => expect(screen.getByTestId('settings-form')).toHaveProperty('disabled', false))
    expect(addToast).toHaveBeenCalledTimes(1)
  })

  it('keeps an external close authoritative when an in-flight save resolves', async () => {
    const save = deferred()
    const cancelSettings = vi.fn()
    const cancelNotificationSettings = vi.fn()
    const onClose = vi.fn()
    useSettingsStore.setState({
      hasUnsavedChanges: true,
      saveSettings: vi.fn(() => save.promise),
      cancelSettings
    })
    useNotificationStore.setState({ cancelSettings: cancelNotificationSettings })
    const view = render(<SettingsModal isOpen={true} onClose={onClose} />)
    fireEvent.click(await screen.findByTestId('settings-save-button'))

    view.rerender(<SettingsModal isOpen={false} onClose={onClose} />)
    expect(cancelSettings).not.toHaveBeenCalled()
    expect(cancelNotificationSettings).not.toHaveBeenCalled()

    save.resolve()
    await waitFor(() => expect(screen.queryByTestId('settings-modal')).toBeNull())
    expect(onClose).not.toHaveBeenCalled()
  })

  it('reports one fixed-copy toast without reopening after an externally closed save rejects', async () => {
    const save = deferred()
    const cancelSettings = vi.fn()
    const cancelNotificationSettings = vi.fn()
    const onClose = vi.fn()
    const addToast = vi.spyOn(useToastStore.getState(), 'addToast')
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    useSettingsStore.setState({
      hasUnsavedChanges: true,
      saveSettings: vi.fn(() => save.promise),
      cancelSettings
    })
    useNotificationStore.setState({ cancelSettings: cancelNotificationSettings })
    const view = render(<SettingsModal isOpen={true} onClose={onClose} />)
    fireEvent.click(await screen.findByTestId('settings-save-button'))
    view.rerender(<SettingsModal isOpen={false} onClose={onClose} />)

    save.reject(new Error('private settings payload'))

    await waitFor(() => {
      expect(addToast).toHaveBeenCalledTimes(1)
      expect(addToast).toHaveBeenCalledWith('Failed to save settings. Please try again.', 'error')
    })
    expect(screen.queryByTestId('settings-modal')).toBeNull()
    expect(cancelSettings).not.toHaveBeenCalled()
    expect(cancelNotificationSettings).toHaveBeenCalledTimes(1)
    expect(onClose).not.toHaveBeenCalled()
    expect(consoleError).not.toHaveBeenCalled()
  })

  it('keeps app persistence truthful when notification saving fails afterward', async () => {
    const persisted = { ...DEFAULT_SETTINGS, scrollbackLines: (DEFAULT_SETTINGS.scrollbackLines ?? 10_000) + 1 }
    const onClose = vi.fn()
    const saveSettings = vi.fn().mockImplementation(async () => {
      useSettingsStore.setState({
        savedSettings: persisted,
        pendingSettings: persisted,
        settings: persisted,
        hasUnsavedChanges: false
      })
    })
    const saveNotificationSettings = vi.fn().mockRejectedValue(new Error('provider secret'))
    const addToast = vi.spyOn(useToastStore.getState(), 'addToast')
    useSettingsStore.setState({ hasUnsavedChanges: true, saveSettings })
    useNotificationStore.setState({
      hasUnsavedChanges: true,
      saveSettings: saveNotificationSettings
    })
    render(<SettingsModal isOpen={true} onClose={onClose} />)

    fireEvent.click(await screen.findByTestId('settings-save-button'))

    await waitFor(() => expect(addToast).toHaveBeenCalledTimes(1))
    expect(useSettingsStore.getState().savedSettings).toEqual(persisted)
    expect(useSettingsStore.getState().hasUnsavedChanges).toBe(false)
    expect(useNotificationStore.getState().hasUnsavedChanges).toBe(false)
    expect(onClose).not.toHaveBeenCalled()
  })
})
