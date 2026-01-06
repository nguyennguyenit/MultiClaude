import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { TaskTracker } from '../task-tracker'

describe('TaskTracker', () => {
  let tracker: TaskTracker

  beforeEach(() => {
    tracker = new TaskTracker()
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  describe('shouldNotify', () => {
    it('returns true for first occurrence of task', () => {
      expect(tracker.shouldNotify('term-1', 'task-abc123')).toBe(true)
    })

    it('returns false for duplicate within TTL', () => {
      tracker.shouldNotify('term-1', 'task-abc123')
      expect(tracker.shouldNotify('term-1', 'task-abc123')).toBe(false)
    })

    it('returns true for different task ID', () => {
      tracker.shouldNotify('term-1', 'task-abc123')
      expect(tracker.shouldNotify('term-1', 'task-xyz789')).toBe(true)
    })

    it('returns false for same task ID in different terminal (global dedup)', () => {
      tracker.shouldNotify('term-1', 'task-abc123')
      expect(tracker.shouldNotify('term-2', 'task-abc123')).toBe(false) // Same task ID = same task globally
    })

    it('returns true after TTL expires', () => {
      tracker.shouldNotify('term-1', 'task-abc123')

      // Advance time past TTL (5 minutes)
      vi.advanceTimersByTime(5 * 60 * 1000 + 1)

      expect(tracker.shouldNotify('term-1', 'task-abc123')).toBe(true)
    })
  })

  describe('clearTerminal', () => {
    it('removes tracking for specific terminal', () => {
      tracker.shouldNotify('term-1', 'task-a')
      tracker.shouldNotify('term-2', 'task-b')

      tracker.clearTerminal('term-1')

      const stats = tracker.getStats()
      expect(stats.terminals).toBe(1)
      expect(stats.tasks).toBe(1)
    })

    it('allows new notification after clear', () => {
      tracker.shouldNotify('term-1', 'task-a')
      tracker.clearTerminal('term-1')

      // After clearing, task should be treated as new
      expect(tracker.shouldNotify('term-1', 'task-a')).toBe(true)
    })

    it('handles clearing non-existent terminal', () => {
      expect(() => tracker.clearTerminal('nonexistent')).not.toThrow()
    })
  })

  describe('clearAll', () => {
    it('removes all tracking data', () => {
      tracker.shouldNotify('term-1', 'task-a')
      tracker.shouldNotify('term-2', 'task-b')
      tracker.shouldNotify('term-3', 'task-c')

      tracker.clearAll()

      const stats = tracker.getStats()
      expect(stats.terminals).toBe(0)
      expect(stats.tasks).toBe(0)
    })
  })

  describe('cleanup', () => {
    it('removes stale entries after TTL', () => {
      tracker.shouldNotify('term-1', 'task-old')

      // Advance time past TTL
      vi.advanceTimersByTime(5 * 60 * 1000 + 1)

      // Add a fresh task
      tracker.shouldNotify('term-2', 'task-new')

      tracker.cleanup()

      const stats = tracker.getStats()
      expect(stats.terminals).toBe(1) // Only term-2
      expect(stats.tasks).toBe(1) // Only task-new
    })

    it('removes empty terminal entries', () => {
      tracker.shouldNotify('term-1', 'task-a')

      vi.advanceTimersByTime(5 * 60 * 1000 + 1)

      tracker.cleanup()

      const stats = tracker.getStats()
      expect(stats.terminals).toBe(0)
    })

    it('does not throw on empty tracker', () => {
      expect(() => tracker.cleanup()).not.toThrow()
    })
  })

  describe('getStats', () => {
    it('returns correct counts', () => {
      tracker.shouldNotify('term-1', 'task-a')
      tracker.shouldNotify('term-1', 'task-b')
      tracker.shouldNotify('term-2', 'task-c')

      const stats = tracker.getStats()
      expect(stats.terminals).toBe(2)
      expect(stats.tasks).toBe(3)
    })

    it('returns zeros for empty tracker', () => {
      const stats = tracker.getStats()
      expect(stats.terminals).toBe(0)
      expect(stats.tasks).toBe(0)
    })
  })
})
