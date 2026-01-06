import { EventEmitter } from 'events'
import { createHash } from 'crypto'
import type { TaskEvent, NotificationEventType } from '@shared/types'
import { ENHANCED_DETECTION_PATTERNS } from '@shared/constants'

/**
 * Enhanced plain text parser with named capture groups for task name extraction.
 * Fallback when stream-json mode is not available.
 */
export class PlainTextParser extends EventEmitter {
  private debounceMap: Map<string, number> = new Map()
  private debounceMs = 5000

  parse(terminalId: string, data: string, projectName: string): void {
    // Check each pattern
    for (const [type, pattern] of Object.entries(ENHANCED_DETECTION_PATTERNS)) {
      const match = data.match(pattern)
      if (match) {
        const key = `${terminalId}:${type}`
        const now = Date.now()
        const lastEmit = this.debounceMap.get(key) || 0

        if (now - lastEmit > this.debounceMs) {
          this.debounceMap.set(key, now)

          // Extract task name from named groups or full match
          const taskName = match.groups?.taskName || (match.groups?.exitCode
            ? `Exit code ${match.groups.exitCode}`
            : match[0].slice(0, 100))

          this.emitTaskEvent(terminalId, type as NotificationEventType, taskName, projectName)
        }
      }
    }
  }

  private emitTaskEvent(terminalId: string, type: NotificationEventType, taskName: string, projectName: string): void {
    const event: TaskEvent = {
      id: this.generateId(terminalId, type, taskName),
      terminalId,
      type,
      taskName,
      projectName,
      timestamp: Date.now()
    }
    this.emit('taskEvent', event)
  }

  private generateId(terminalId: string, type: string, content: string): string {
    return createHash('sha256')
      .update(`${terminalId}:${type}:${content}`)
      .digest('hex')
      .slice(0, 16)
  }

  clearTerminal(terminalId: string): void {
    // Clear debounce entries for this terminal
    for (const [key] of this.debounceMap) {
      if (key.startsWith(`${terminalId}:`)) {
        this.debounceMap.delete(key)
      }
    }
  }

  /** Clean up stale debounce entries older than 60s */
  cleanup(): void {
    const now = Date.now()
    for (const [key, time] of this.debounceMap) {
      if (now - time > 60000) {
        this.debounceMap.delete(key)
      }
    }
  }
}
