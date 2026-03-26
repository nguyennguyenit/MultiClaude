import type { NotificationSettings, SoundPreset } from '../types/notification'

// Task tracker constants
export const TASK_TRACKER_TTL_MS = 5 * 60 * 1000 // 5 minutes
export const TASK_TRACKER_CLEANUP_INTERVAL_MS = 60 * 1000 // 1 minute

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
  discordConfigured: false,
  // Enhanced notification tracking defaults
  outputMode: 'auto',
  notifyOnlyBackground: true,
  includeTaskSummary: true,
  remoteControlEnabled: false
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
} as const

// Enhanced detection patterns with named capture groups for task name extraction
// Used by PlainTextParser for richer notifications
export const ENHANCED_DETECTION_PATTERNS = {
  // Extract task name after checkmark: "✓ Fix login bug" → taskName="Fix login bug"
  taskComplete: /✓\s+(?<taskName>.+?)(?:\s*\(completed\)|$)/i,
  // Extract task name and optional exit code from failures
  taskFailed: /✗\s+(?<taskName>.+?)(?:\s*\(failed\)|$)|exit(?:ed)?\s+(?:with\s+)?code\s+(?<exitCode>\d+)/i,
  // Match review/approval prompts
  reviewNeeded: /\[Y\/n\]|\(y\/N\)|approve|allow\s+(?:this\s+)?tool|waiting\s+for\s+(?:your\s+)?(?:input|response|confirmation)/i
} as const
