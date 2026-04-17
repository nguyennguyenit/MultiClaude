import { describe, it, expect, beforeEach } from 'vitest'
import { CallbackIdempotencyCache } from '../callback-idempotency'

describe('CallbackIdempotencyCache', () => {
  let cache: CallbackIdempotencyCache

  beforeEach(() => {
    cache = new CallbackIdempotencyCache(5) // small cap for deterministic eviction tests
  })

  it('first seen of an id returns true', () => {
    expect(cache.seen('cq-1')).toBe(false)
    expect(cache.seen('cq-1')).toBe(true)
  })

  it('tracks distinct ids independently', () => {
    expect(cache.seen('a')).toBe(false)
    expect(cache.seen('b')).toBe(false)
    expect(cache.seen('a')).toBe(true)
    expect(cache.seen('b')).toBe(true)
  })

  it('evicts oldest when capacity exceeded', () => {
    for (let i = 0; i < 5; i++) cache.seen(`cq-${i}`)
    cache.seen('cq-5') // evicts cq-0

    expect(cache.seen('cq-0')).toBe(false) // re-accepted as fresh
    // cq-5 stays known
    expect(cache.seen('cq-5')).toBe(true)
  })

  it('accessing an id does not refresh recency (pure insertion-order)', () => {
    for (let i = 0; i < 5; i++) cache.seen(`cq-${i}`)
    cache.seen('cq-0') // duplicate-seen check, but shouldn't bump
    cache.seen('cq-5') // evicts cq-0 since cq-0 was oldest by insertion

    expect(cache.seen('cq-0')).toBe(false)
  })

  it('size reflects contents up to cap', () => {
    for (let i = 0; i < 3; i++) cache.seen(`id-${i}`)
    expect(cache.size()).toBe(3)
    for (let i = 3; i < 10; i++) cache.seen(`id-${i}`)
    expect(cache.size()).toBe(5)
  })

  it('default capacity is 200', () => {
    const big = new CallbackIdempotencyCache()
    for (let i = 0; i < 200; i++) big.seen(`x-${i}`)
    expect(big.size()).toBe(200)
    big.seen('x-200')
    expect(big.size()).toBe(200)
    expect(big.seen('x-0')).toBe(false) // evicted
  })
})
