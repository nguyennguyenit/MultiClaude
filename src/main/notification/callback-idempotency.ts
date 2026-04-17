const DEFAULT_CAPACITY = 200

/**
 * Tracks `callback_query.id` values seen by the Telegram poller.
 * Insertion-order LRU — once capacity is hit, oldest id is evicted.
 * `seen(id)` returns true on a duplicate, false on first sight.
 */
export class CallbackIdempotencyCache {
  private readonly set: Set<string> = new Set()
  private readonly capacity: number

  constructor(capacity: number = DEFAULT_CAPACITY) {
    this.capacity = capacity
  }

  seen(id: string): boolean {
    if (this.set.has(id)) return true
    this.set.add(id)
    if (this.set.size > this.capacity) {
      const oldest = this.set.values().next().value
      if (oldest !== undefined) this.set.delete(oldest)
    }
    return false
  }

  size(): number {
    return this.set.size
  }

  reset(): void {
    this.set.clear()
  }
}

/** Shared singleton for the notification pipeline. */
export const callbackIdempotencyCache = new CallbackIdempotencyCache()
