import { create } from 'zustand'
import type { NotificationSettings, NotificationEvent, SoundPreset, RemoteControlStatus } from '@shared/types'
import { DEFAULT_NOTIFICATION_SETTINGS } from '@shared/constants'

interface NotificationState {
  settings: NotificationSettings
  isLoading: boolean
  remoteControlStatus: RemoteControlStatus
  loadSettings: () => Promise<void>
  updateSettings: (partial: Partial<NotificationSettings>) => Promise<void>
  playSound: (type: 'success' | 'error' | 'info') => void
}

// Sound cache for reuse
const soundCache = new Map<string, HTMLAudioElement>()

function getSound(preset: SoundPreset, type: string): HTMLAudioElement {
  const key = `${preset}-${type}`
  if (!soundCache.has(key)) {
    const audio = new Audio(`/sounds/${preset}-${type}.mp3`)
    audio.preload = 'auto'
    soundCache.set(key, audio)
  }
  return soundCache.get(key)!
}

export const useNotificationStore = create<NotificationState>((set, get) => ({
  settings: DEFAULT_NOTIFICATION_SETTINGS,
  isLoading: false,
  remoteControlStatus: 'disconnected',

  loadSettings: async () => {
    set({ isLoading: true })
    try {
      const settings = await window.electron.notification.getSettings()
      set({ settings, isLoading: false })
    } catch (error) {
      console.error('Failed to load notification settings:', error)
      set({ isLoading: false })
    }
  },

  updateSettings: async (partial) => {
    const current = get().settings
    const updated = { ...current, ...partial }
    set({ settings: updated })

    try {
      await window.electron.notification.setSettings(partial)
    } catch (error) {
      console.error('Failed to save notification settings:', error)
      set({ settings: current })
    }
  },

  playSound: (type) => {
    const { settings } = get()
    if (!settings.soundEnabled) return

    try {
      const audio = getSound(settings.soundPreset, type)
      audio.currentTime = 0
      audio.play().catch(() => {})
    } catch {
      // Ignore sound errors
    }
  }
}))

// Setup notification event listener - call once in App
export function setupNotificationListener(): () => void {
  const handleEvent = (event: NotificationEvent) => {
    const { playSound } = useNotificationStore.getState()

    switch (event.type) {
      case 'taskComplete':
        playSound('success')
        break
      case 'taskFailed':
        playSound('error')
        break
      case 'reviewNeeded':
        playSound('info')
        break
    }
  }

  const cleanupEvent = window.electron.notification.onEvent(handleEvent)

  // Listen for remote control status changes
  const cleanupRemoteStatus = window.electron.notification.onRemoteControlStatus((status) => {
    useNotificationStore.setState({ remoteControlStatus: status })
  })

  // Load initial remote control status
  window.electron.notification.getRemoteControlStatus().then((status) => {
    useNotificationStore.setState({ remoteControlStatus: status })
  })

  return () => {
    cleanupEvent()
    cleanupRemoteStatus()
  }
}
