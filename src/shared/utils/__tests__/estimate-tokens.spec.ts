import { describe, it, expect, beforeEach } from 'vitest'
import { estimateTokens, __resetEncoderForTests } from '../estimate-tokens'

describe('estimateTokens', () => {
  beforeEach(() => {
    __resetEncoderForTests(false)
  })

  it('returns 0 for null/undefined/empty', () => {
    expect(estimateTokens(null)).toBe(0)
    expect(estimateTokens(undefined)).toBe(0)
    expect(estimateTokens('')).toBe(0)
  })

  it('counts ASCII tokens via tiktoken', () => {
    // "Hello, world!" → o200k_base typically 4 tokens
    const n = estimateTokens('Hello, world!')
    expect(n).toBeGreaterThan(0)
    expect(n).toBeLessThan(10)
  })

  it('counts Vietnamese diacritics', () => {
    // Vietnamese text should produce non-trivial tokens
    const n = estimateTokens('Xin chào bạn, hôm nay thế nào?')
    expect(n).toBeGreaterThan(5)
    expect(n).toBeLessThan(40)
  })

  it('counts CJK characters', () => {
    const n = estimateTokens('你好世界')
    expect(n).toBeGreaterThan(0)
    expect(n).toBeLessThan(15)
  })

  it('counts emoji', () => {
    const n = estimateTokens('🚀🎉✨')
    expect(n).toBeGreaterThan(0)
  })

  it('scales roughly linearly for larger ASCII blobs', () => {
    const short = estimateTokens('hello '.repeat(10))
    const long = estimateTokens('hello '.repeat(100))
    expect(long).toBeGreaterThan(short * 5)
  })

  it('falls back to chars/4 when encoder fails', () => {
    __resetEncoderForTests(true)
    const text = 'a'.repeat(100)
    expect(estimateTokens(text)).toBe(25)
  })
})
