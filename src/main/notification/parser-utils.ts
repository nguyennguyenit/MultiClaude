import { createHash } from 'crypto'

/**
 * Generate a unique task event ID using SHA256 hash.
 * Used for deduplication in TaskTracker.
 * @param terminalId - Terminal that generated the event
 * @param type - Event type (taskComplete, taskFailed, reviewNeeded)
 * @param content - Task name or content for uniqueness
 * @returns First 16 characters of SHA256 hex hash
 */
export function generateTaskEventId(terminalId: string, type: string, content: string): string {
  return createHash('sha256')
    .update(`${terminalId}:${type}:${content}`)
    .digest('hex')
    .slice(0, 16)
}

// Max input length for regex matching to prevent ReDoS
export const MAX_REGEX_INPUT_LENGTH = 10000
