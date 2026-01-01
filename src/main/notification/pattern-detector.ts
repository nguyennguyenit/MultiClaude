import { EventEmitter } from 'events'
import type { NotificationEventType } from '@shared/types'
import { DETECTION_PATTERNS } from '@shared/constants'

interface DetectionResult {
  type: NotificationEventType
  match: string
}

export class PatternDetector extends EventEmitter {
  private debounceMap: Map<string, number> = new Map()
  // 5 second debounce to prevent notification spam from repeated patterns
  private debounceMs = 5000

  // Check terminal output for notification patterns
  detect(terminalId: string, output: string): DetectionResult | null {
    for (const [type, pattern] of Object.entries(DETECTION_PATTERNS)) {
      const match = output.match(pattern)
      if (match) {
        const key = `${terminalId}:${type}`
        const now = Date.now()
        const lastEmit = this.debounceMap.get(key) || 0

        // Debounce same event type from same terminal
        if (now - lastEmit > this.debounceMs) {
          this.debounceMap.set(key, now)
          return {
            type: type as NotificationEventType,
            match: match[0]
          }
        }
      }
    }
    return null
  }

  // Clean up old debounce entries
  cleanup(): void {
    const now = Date.now()
    for (const [key, time] of this.debounceMap) {
      if (now - time > 60000) {
        this.debounceMap.delete(key)
      }
    }
  }
}
