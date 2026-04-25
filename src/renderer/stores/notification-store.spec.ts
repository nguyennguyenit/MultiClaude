import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { NotificationSettings, TerminalTaskStatus } from '@shared/types'
import { DEFAULT_NOTIFICATION_SETTINGS } from '@shared/constants'
import { setupNotificationListener, useNotificationStore } from './notification-store'
import { useAppStore } from './app-store'

function cloneDefaultSettings(): NotificationSettings {
  return structuredClone(DEFAULT_NOTIFICATION_SETTINGS)
}

describe('useNotificationStore', () => {
  const getSettings = vi.fn<() => Promise<NotificationSettings>>()
  const setSettings = vi.fn<(settings: Partial<NotificationSettings>) => Promise<NotificationSettings>>()

  beforeEach(() => {
    getSettings.mockReset()
    setSettings.mockReset()

    const persisted = cloneDefaultSettings()
    getSettings.mockResolvedValue(persisted)
    setSettings.mockImplementation(async (settings) => ({ ...persisted, ...settings }))

    vi.stubGlobal('window', {
      electron: {
        notification: {
          getSettings,
          setSettings
        }
      }
    })
  })

  it('tracks notification changes as unsaved until saveSettings persists them', async () => {
    await useNotificationStore.getState().loadSettings()

    useNotificationStore.getState().updateSettings({ soundEnabled: false })

    expect(setSettings).not.toHaveBeenCalled()
    expect(useNotificationStore.getState().savedSettings.soundEnabled).toBe(true)
    expect(useNotificationStore.getState().pendingSettings.soundEnabled).toBe(false)
    expect(useNotificationStore.getState().hasUnsavedChanges).toBe(true)

    await useNotificationStore.getState().saveSettings()

    expect(setSettings).toHaveBeenCalledWith(expect.objectContaining({ soundEnabled: false }))
    expect(useNotificationStore.getState().savedSettings.soundEnabled).toBe(false)
    expect(useNotificationStore.getState().hasUnsavedChanges).toBe(false)
  })

  it('setupNotificationListener routes pane-status events into app-store taskStatus', () => {
    let paneStatusCb: ((p: { terminalId: string; status: TerminalTaskStatus }) => void) | null = null
    vi.stubGlobal('window', {
      electron: {
        notification: {
          onEvent: vi.fn(() => () => {}),
          onRemoteControlStatus: vi.fn(() => () => {}),
          getRemoteControlStatus: vi.fn(() => Promise.resolve('disconnected')),
          onPaneStatusChanged: vi.fn((cb: (p: { terminalId: string; status: TerminalTaskStatus }) => void) => {
            paneStatusCb = cb
            return () => {}
          })
        }
      }
    })

    useAppStore.setState({
      terminals: [
        { id: 't1', title: 't1', cwd: '/', isClaudeMode: true, createdAt: new Date().toISOString() }
      ],
      activeTerminalId: 't1'
    })

    const cleanup = setupNotificationListener()
    const cb = paneStatusCb as ((p: { terminalId: string; status: TerminalTaskStatus }) => void) | null
    expect(cb).not.toBeNull()

    cb!({ terminalId: 't1', status: 'done' })
    expect(useAppStore.getState().terminals[0].taskStatus).toBe('done')

    cb!({ terminalId: 't1', status: 'failed' })
    expect(useAppStore.getState().terminals[0].taskStatus).toBe('failed')

    cleanup()
  })

  it('cancelSettings restores the saved notification state', async () => {
    await useNotificationStore.getState().loadSettings()

    useNotificationStore.getState().updateSettings({ includeTaskSummary: false })
    useNotificationStore.getState().cancelSettings()

    expect(useNotificationStore.getState().pendingSettings.includeTaskSummary).toBe(true)
    expect(useNotificationStore.getState().hasUnsavedChanges).toBe(false)
  })
})
