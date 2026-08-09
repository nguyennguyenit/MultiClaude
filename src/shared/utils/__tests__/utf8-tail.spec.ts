import { describe, expect, it } from 'vitest'
import { truncateUtf8Tail, utf8ByteLength, Utf8TailBuffer } from '../utf8-tail'

describe('UTF-8 bounded tails', () => {
  it('keeps ASCII tails within the byte limit', () => {
    expect(truncateUtf8Tail('abcdef', 3)).toBe('def')
    expect(utf8ByteLength(truncateUtf8Tail('abcdef', 3))).toBe(3)
  })

  it('never splits Vietnamese or emoji scalars at the boundary', () => {
    const tail = truncateUtf8Tail('prefix-Tiếng Việt-✅', 12)
    expect(tail).not.toContain('\uFFFD')
    expect(utf8ByteLength(tail)).toBeLessThanOrEqual(12)
    expect(tail.endsWith('✅')).toBe(true)
  })

  it('accumulates chunks without changing their serialized content below the cap', () => {
    const tail = new Utf8TailBuffer(20, 12)
    tail.append('hello ')
    tail.append('world')

    expect(tail.toString()).toBe('hello world')
    expect(tail.byteLength).toBe(11)
  })

  it('trims at a complete line and preserves UTF-8 scalars after crossing the cap', () => {
    const tail = new Utf8TailBuffer(24, 18)
    tail.append('old line\n')
    tail.append('Tiếng Việt✅')

    expect(tail.toString()).toBe('Tiếng Việt✅')
    expect(tail.toString()).not.toContain('\uFFFD')
    expect(tail.byteLength).toBeLessThanOrEqual(18)
  })

  it('clears retained chunks and rejects invalid limits', () => {
    const tail = new Utf8TailBuffer(10, 5)
    tail.append('secret')
    tail.clear()

    expect(tail.toString()).toBe('')
    expect(tail.byteLength).toBe(0)
    expect(() => new Utf8TailBuffer(4, 5)).toThrow(RangeError)
  })
})
