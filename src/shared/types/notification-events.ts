import type { NotificationEventType, OutputMode } from './notification'

/**
 * Unique task event emitted by output parsers.
 * Used by NotificationManager for deduplication and rich notifications.
 */
export interface TaskEvent {
  /** SHA256 hash (first 16 chars) for deduplication */
  id: string
  /** Terminal that generated this event */
  terminalId: string
  /** Event classification */
  type: NotificationEventType
  /** Extracted task/tool name from output */
  taskName: string
  /** Project name from terminal metadata */
  projectName: string
  /** Additional context (last tool used, duration, etc.) */
  context?: string
  /** Unix timestamp in milliseconds */
  timestamp: number
}

/**
 * Claude Code stream-json event structure.
 * Based on --output-format=stream-json NDJSON output.
 */
export interface JsonStreamEvent {
  /** Event type from Claude Code stream */
  type: 'init' | 'message' | 'tool_use' | 'tool_result' | 'result' | 'error'
  /** Tool name (for tool_use events) */
  tool_name?: string
  /** Event ID from stream */
  id?: string
  /** Tool input parameters (for tool_use events) */
  input?: Record<string, unknown>
  /** Reference to tool_use event (for tool_result events) */
  tool_use_id?: string
  /** Message or result content */
  content?: string
  /** Error flag (for tool_result events) */
  is_error?: boolean
  /** Model name (from result events, e.g. "claude-opus-4-5") */
  model?: string
  /** Total session duration in milliseconds (from result events) */
  duration_ms?: number
}

// Re-export OutputMode as ParserType for parser-specific usage (alias)
export type ParserType = OutputMode
