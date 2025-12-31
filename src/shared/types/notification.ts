// Notification event types
export type NotificationEventType = 'taskComplete' | 'taskFailed' | 'reviewNeeded'

// Sound preset options
export type SoundPreset = 'default' | 'minimal' | 'retro'

// Main settings interface (stored in localStorage via Zustand)
export interface NotificationSettings {
  // Event toggles
  onTaskComplete: boolean
  onTaskFailed: boolean
  onReviewNeeded: boolean

  // Sound
  soundEnabled: boolean
  soundPreset: SoundPreset

  // Telegram (credentials stored securely via IPC)
  telegramEnabled: boolean
  telegramConfigured: boolean

  // Discord (credentials stored securely via IPC)
  discordEnabled: boolean
  discordConfigured: boolean
}

// Telegram credentials (never stored in renderer)
export interface TelegramCredentials {
  botToken: string
  chatId: string
}

// Discord credentials (never stored in renderer)
export interface DiscordCredentials {
  webhookUrl: string
}

// Notification event payload
export interface NotificationEvent {
  type: NotificationEventType
  terminalId: string
  message: string
  timestamp: number
}

// Test result for external platforms
export interface NotificationTestResult {
  success: boolean
  error?: string
}
