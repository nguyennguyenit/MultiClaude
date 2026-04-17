export interface CallbackRateLimiterOptions {
  /** Max tokens the bucket can hold (burst size). Default 10. */
  capacity?: number
  /** Tokens refilled per second. Default 10. */
  refillPerSecond?: number
}

const DEFAULT_CAPACITY = 10
const DEFAULT_REFILL = 10

/**
 * Global token bucket for inbound Telegram callbacks.
 * `tryAcquire()` returns true if a token was available.
 * Refill is lazy — computed from wall clock on each call.
 */
export class CallbackRateLimiter {
  private readonly capacity: number
  private readonly refillPerMs: number
  private tokens: number
  private lastRefillAt: number

  constructor(options: CallbackRateLimiterOptions = {}) {
    this.capacity = options.capacity ?? DEFAULT_CAPACITY
    this.refillPerMs = (options.refillPerSecond ?? DEFAULT_REFILL) / 1000
    this.tokens = this.capacity
    this.lastRefillAt = Date.now()
  }

  tryAcquire(): boolean {
    this.refill()
    if (this.tokens >= 1) {
      this.tokens -= 1
      return true
    }
    return false
  }

  private refill(): void {
    const now = Date.now()
    const elapsed = now - this.lastRefillAt
    if (elapsed <= 0) return
    this.tokens = Math.min(this.capacity, this.tokens + elapsed * this.refillPerMs)
    this.lastRefillAt = now
  }

  reset(): void {
    this.tokens = this.capacity
    this.lastRefillAt = Date.now()
  }
}

/** Shared singleton for the notification pipeline. */
export const callbackRateLimiter = new CallbackRateLimiter()
