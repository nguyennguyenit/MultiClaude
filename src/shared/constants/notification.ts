import type { NotificationSettings, SoundPreset } from '../types/notification'

// Default notification settings
export const DEFAULT_NOTIFICATION_SETTINGS: NotificationSettings = {
  onTaskComplete: true,
  onTaskFailed: true,
  onReviewNeeded: true,
  soundEnabled: true,
  soundPreset: 'default',
  telegramEnabled: false,
  telegramConfigured: false,
  discordEnabled: false,
  discordConfigured: false
}

// Sound preset definitions
export const SOUND_PRESETS: { id: SoundPreset; name: string; description: string }[] = [
  { id: 'default', name: 'Default', description: 'Standard notification sounds' },
  { id: 'minimal', name: 'Minimal', description: 'Subtle, soft tones' },
  { id: 'retro', name: 'Retro', description: '8-bit style sounds' }
]

// Pattern detection (placeholder - update after research)
export const DETECTION_PATTERNS = {
  taskComplete: /✓.*completed|Task completed|Done!|finished successfully/i,
  taskFailed: /✗.*failed|Error:|Task failed|FAILED/i,
  reviewNeeded: /review needed|waiting for review|needs review|please review/i
}
