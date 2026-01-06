import { TASK_TRACKER_TTL_MS } from '@shared/constants'

/**
 * Tracks seen task IDs to prevent duplicate notifications.
 * Uses SHA256 hash-based task IDs with configurable TTL.
 */
export class TaskTracker {
  private seenTasks: Map<string, Set<string>> = new Map() // terminalId -> Set<taskId>
  private timestamps: Map<string, number> = new Map() // taskId -> timestamp
  private ttlMs: number

  constructor(ttlMs: number = TASK_TRACKER_TTL_MS) {
    this.ttlMs = ttlMs
  }

  /**
   * Check if task should trigger notification.
   * Returns true if task hasn't been seen recently.
   */
  shouldNotify(terminalId: string, taskId: string): boolean {
    // Validate inputs
    if (!terminalId || !taskId || typeof terminalId !== 'string' || typeof taskId !== 'string') {
      return true // Safe fallback: notify on invalid input
    }

    const now = Date.now()

    // Check if we've seen this exact task recently
    const lastSeen = this.timestamps.get(taskId)
    if (lastSeen && now - lastSeen < this.ttlMs) {
      return false // Still within cooldown
    }

    // Track this task
    const terminalTasks = this.seenTasks.get(terminalId) || new Set()
    terminalTasks.add(taskId)
    this.seenTasks.set(terminalId, terminalTasks)
    this.timestamps.set(taskId, now)

    return true
  }

  /**
   * Clear tracking for a specific terminal (on terminal destroy/project switch)
   */
  clearTerminal(terminalId: string): void {
    const tasks = this.seenTasks.get(terminalId)
    if (tasks) {
      for (const taskId of tasks) {
        this.timestamps.delete(taskId)
      }
      this.seenTasks.delete(terminalId)
    }
  }

  /**
   * Clear all tracking (on app restart)
   */
  clearAll(): void {
    this.seenTasks.clear()
    this.timestamps.clear()
  }

  /**
   * Periodic cleanup of stale entries
   */
  cleanup(): void {
    const now = Date.now()

    // Remove stale timestamps
    for (const [taskId, timestamp] of this.timestamps) {
      if (now - timestamp > this.ttlMs) {
        this.timestamps.delete(taskId)

        // Remove from terminal sets
        for (const [, tasks] of this.seenTasks) {
          tasks.delete(taskId)
        }
      }
    }

    // Remove empty terminal entries
    for (const [terminalId, tasks] of this.seenTasks) {
      if (tasks.size === 0) {
        this.seenTasks.delete(terminalId)
      }
    }
  }

  /**
   * Get stats for debugging
   */
  getStats(): { terminals: number; tasks: number } {
    return {
      terminals: this.seenTasks.size,
      tasks: this.timestamps.size
    }
  }
}
