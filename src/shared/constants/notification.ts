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

// Pattern detection for Claude Code terminal output
// These patterns match Claude Code's specific output format
export const DETECTION_PATTERNS = {
  // Claude Code shows "✓ Task completed" or similar when done
  taskComplete: /✓\s*(Task\s+)?completed|Task\s+completed\s+successfully|finished\s+successfully/i,
  // Match specific task failure indicators, not generic "Error:" which appears everywhere
  // Claude Code shows "✗ Task failed" or "Task failed:" when a task actually fails
  taskFailed: /✗\s*(Task\s+)?failed|^Task\s+failed[:\s]|command\s+failed\s+with\s+exit\s+code/i,
  reviewNeeded: /review\s+needed|waiting\s+for\s+review|needs\s+review|please\s+review/i
}
