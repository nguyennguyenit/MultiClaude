import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { NotificationSettings } from '@shared/types'
import { DEFAULT_NOTIFICATION_SETTINGS } from '@shared/constants'
import { useNotificationStore } from './notification-store'

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

  it('cancelSettings restores the saved notification state', async () => {
    await useNotificationStore.getState().loadSettings()

    useNotificationStore.getState().updateSettings({ includeTaskSummary: false })
    useNotificationStore.getState().cancelSettings()

    expect(useNotificationStore.getState().pendingSettings.includeTaskSummary).toBe(true)
    expect(useNotificationStore.getState().hasUnsavedChanges).toBe(false)
  })
})
