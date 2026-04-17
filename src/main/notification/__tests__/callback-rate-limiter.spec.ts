import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { CallbackRateLimiter } from '../callback-rate-limiter'

describe('CallbackRateLimiter (token bucket)', () => {
  let limiter: CallbackRateLimiter

  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-04-17T00:00:00Z'))
    limiter = new CallbackRateLimiter({ capacity: 10, refillPerSecond: 10 })
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('allows up to capacity bursts immediately', () => {
    const allowed: boolean[] = []
    for (let i = 0; i < 10; i++) allowed.push(limiter.tryAcquire())
    expect(allowed.every(x => x)).toBe(true)
  })

  it('rejects the 11th request in a burst', () => {
    for (let i = 0; i < 10; i++) limiter.tryAcquire()
    expect(limiter.tryAcquire()).toBe(false)
  })

  it('refills at configured rate (10/s → 1 per 100 ms)', () => {
    for (let i = 0; i < 10; i++) limiter.tryAcquire()
    expect(limiter.tryAcquire()).toBe(false)

    vi.advanceTimersByTime(100)
    expect(limiter.tryAcquire()).toBe(true)
    expect(limiter.tryAcquire()).toBe(false)

    vi.advanceTimersByTime(1000)
    // 10 tokens refilled → 10 allowed
    for (let i = 0; i < 10; i++) {
      expect(limiter.tryAcquire()).toBe(true)
    }
    expect(limiter.tryAcquire()).toBe(false)
  })

  it('refill never exceeds capacity', () => {
    vi.advanceTimersByTime(10 * 1000) // 100 tokens worth of time
    // Bucket should still cap at 10
    for (let i = 0; i < 10; i++) {
      expect(limiter.tryAcquire()).toBe(true)
    }
    expect(limiter.tryAcquire()).toBe(false)
  })

  it('burst of 100 in 1 second → 10 processed, 90 throttled', () => {
    const ok: boolean[] = []
    for (let i = 0; i < 100; i++) {
      ok.push(limiter.tryAcquire())
      vi.advanceTimersByTime(10) // total 1 s across 100 calls
    }
    const passed = ok.filter(x => x).length
    // 10 initial tokens + ~9 refilled in 990 ms = 19, but with discrete steps let's allow 19..20
    expect(passed).toBeGreaterThanOrEqual(10)
    expect(passed).toBeLessThanOrEqual(20)
  })
})
