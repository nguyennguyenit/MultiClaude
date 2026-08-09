import { create } from 'zustand'
import type { NotificationSettings, RemoteControlStatus } from '@shared/types'
import { DEFAULT_NOTIFICATION_SETTINGS } from '@shared/constants'
import { useAppStore } from './app-store'

interface NotificationState {
  savedSettings: NotificationSettings
  pendingSettings: NotificationSettings
  hasUnsavedChanges: boolean
  isLoading: boolean
  remoteControlStatus: RemoteControlStatus
  loadSettings: () => Promise<void>
  updateSettings: (partial: Partial<NotificationSettings>) => void
  saveSettings: () => Promise<void>
  cancelSettings: () => void
  refreshIntegrationSettings: () => Promise<void>
}

function areNotificationSettingsEqual(a: NotificationSettings, b: NotificationSettings): boolean {
  return (
    a.onTaskComplete === b.onTaskComplete &&
    a.onTaskFailed === b.onTaskFailed &&
    a.onReviewNeeded === b.onReviewNeeded &&
    a.telegramEnabled === b.telegramEnabled &&
    a.telegramConfigured === b.telegramConfigured &&
    a.discordEnabled === b.discordEnabled &&
    a.discordConfigured === b.discordConfigured &&
    a.outputMode === b.outputMode &&
    a.notifyOnlyBackground === b.notifyOnlyBackground &&
    a.includeTaskSummary === b.includeTaskSummary &&
    a.remoteControlEnabled === b.remoteControlEnabled
  )
}

function getPersistableSettings(settings: NotificationSettings): Partial<NotificationSettings> {
  return {
    onTaskComplete: settings.onTaskComplete,
    onTaskFailed: settings.onTaskFailed,
    onReviewNeeded: settings.onReviewNeeded,
    telegramEnabled: settings.telegramEnabled,
    discordEnabled: settings.discordEnabled,
    outputMode: settings.outputMode,
    notifyOnlyBackground: settings.notifyOnlyBackground,
    includeTaskSummary: settings.includeTaskSummary,
    remoteControlEnabled: settings.remoteControlEnabled
  }
}

export const useNotificationStore = create<NotificationState>((set, get) => ({
  savedSettings: DEFAULT_NOTIFICATION_SETTINGS,
  pendingSettings: DEFAULT_NOTIFICATION_SETTINGS,
  hasUnsavedChanges: false,
  isLoading: false,
  remoteControlStatus: 'disconnected',

  loadSettings: async () => {
    set({ isLoading: true })
    try {
      const settings = await window.electron.notification.getSettings()
      set({
        savedSettings: settings,
        pendingSettings: settings,
        hasUnsavedChanges: false,
        isLoading: false
      })
    } catch (error) {
      console.error('Failed to load notification settings:', error)
      set({ isLoading: false })
    }
  },

  updateSettings: (partial) => {
    const pendingSettings = { ...get().pendingSettings, ...partial }
    set({
      pendingSettings,
      hasUnsavedChanges: !areNotificationSettingsEqual(pendingSettings, get().savedSettings)
    })
  },

  saveSettings: async () => {
    if (!get().hasUnsavedChanges) return

    const pendingSettings = get().pendingSettings
    try {
      const savedSettings = await window.electron.notification.setSettings(getPersistableSettings(pendingSettings))
      set({
        savedSettings,
        pendingSettings: savedSettings,
        hasUnsavedChanges: false
      })
    } catch (error) {
      console.error('Failed to save notification settings:', error)
      throw error
    }
  },

  cancelSettings: () => {
    set({
      pendingSettings: { ...get().savedSettings },
      hasUnsavedChanges: false
    })
  },

  refreshIntegrationSettings: async () => {
    try {
      const savedSettings = await window.electron.notification.getSettings()
      const pendingSettings = {
        ...get().pendingSettings,
        telegramEnabled: savedSettings.telegramEnabled,
        telegramConfigured: savedSettings.telegramConfigured,
        discordEnabled: savedSettings.discordEnabled,
        discordConfigured: savedSettings.discordConfigured
      }

      set({
        savedSettings,
        pendingSettings,
        hasUnsavedChanges: !areNotificationSettingsEqual(pendingSettings, savedSettings)
      })
    } catch (error) {
      console.error('Failed to refresh notification integrations:', error)
    }
  }
}))

// Setup notification event listener - call once in App
export function setupNotificationListener(): () => void {
  // Listen for remote control status changes
  const cleanupRemoteStatus = window.electron.notification.onRemoteControlStatus((status) => {
    useNotificationStore.setState({ remoteControlStatus: status })
  })

  // Listen for per-pane task status updates (Phase 2: Context Drawer switcher)
  const cleanupPaneStatus = window.electron.notification.onPaneStatusChanged(({ terminalId, status }) => {
    useAppStore.getState().updateTerminalTaskStatus(terminalId, status)
  })

  // Load initial remote control status
  window.electron.notification.getRemoteControlStatus().then((status) => {
    useNotificationStore.setState({ remoteControlStatus: status })
  })

  return () => {
    cleanupRemoteStatus()
    cleanupPaneStatus()
  }
}
