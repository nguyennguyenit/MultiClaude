import type { NotificationSettings, SoundPreset } from '../types/notification'
import type { AgentType } from '../types'

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
  // Legacy review pattern — only consumed by the deprecated PatternDetector. Kept
  // narrowly scoped to "review" phrases that do not collide with Claude's TUI
  // redraw output (see plain-text-parser.ts REVIEW_PATTERN for the canonical
  // tightened prompt pattern).
  reviewNeeded: /review\s+needed|waiting\s+for\s+review|needs\s+review|please\s+review/i
} as const

/**
 * Canonical tightened approval-prompt regex. Single source of truth — consumed by
 * PlainTextParser (live emission path) and re-exposed via ENHANCED_DETECTION_PATTERNS
 * for legacy callers. Loose sub-patterns (`approve` alone, `waiting for input`,
 * `allow this tool`) were intentionally removed to stop SIGWINCH/resize redraw
 * false-triggers — see plan plans/20260417-1850-fix-review-needed-false-trigger/.
 * English-only by design; localized builds must use the hook path instead.
 */
export const REVIEW_PROMPT_PATTERN = /\[Y\/n\]|\(y\/N\)|[Dd]o you want to (?:proceed|continue|approve)[\s\S]{0,40}\?|[Aa]llow\s+[`']?\w[\w-]*[`']?\s+to\s+(?:run|execute)/

// Enhanced detection patterns with named capture groups for task name extraction
// Used by PlainTextParser for richer notifications
export const ENHANCED_DETECTION_PATTERNS = {
  // Extract task name after checkmark: "✓ Fix login bug" → taskName="Fix login bug"
  taskComplete: /✓\s+(?<taskName>.+?)(?:\s*\(completed\)|$)/i,
  // Extract task name and optional exit code from failures
  taskFailed: /✗\s+(?<taskName>.+?)(?:\s*\(failed\)|$)|exit(?:ed)?\s+(?:with\s+)?code\s+(?<exitCode>\d+)/i,
  // Same regex as REVIEW_PROMPT_PATTERN (single source of truth).
  reviewNeeded: REVIEW_PROMPT_PATTERN
} as const

// Agent command detection patterns
// Matches command binary name from terminal input (e.g. "codex", "codex --model gpt-4")
export const AGENT_DETECTION_PATTERNS: Record<string, AgentType> = {
  'claude': 'claude',
  'codex': 'codex',
  'gemini': 'gemini',
  'aider': 'aider',
}

// Human-readable display names for each agent type
export const AGENT_DISPLAY_NAMES: Record<AgentType, string> = {
  claude: 'Claude Code',
  codex: 'Codex CLI',
  gemini: 'Gemini CLI',
  aider: 'Aider',
  generic: 'Terminal',
}

// Badge colors for terminal pane (CSS background-color)
export const AGENT_BADGE_COLORS: Record<AgentType, string> = {
  claude: '#a855f7',  // purple
  codex: '#22c55e',   // green
  gemini: '#3b82f6',  // blue
  aider: '#f97316',   // orange
  generic: '#6b7280', // gray
}

// Short badge text for terminal tab
export const AGENT_BADGE_TEXT: Record<AgentType, string> = {
  claude: 'AI',
  codex: 'CX',
  gemini: 'GM',
  aider: 'AD',
  generic: '??',
}
