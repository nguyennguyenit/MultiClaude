import { describe, it, expect } from 'vitest'
import { formatTokens } from '../format-tokens'

describe('formatTokens', () => {
  it.each([
    [0, '0'],
    [1, '1'],
    [999, '999'],
    [1000, '1.0k'],
    [1234, '1.2k'],
    [999999, '1000.0k'],
    [1_000_000, '1.00M'],
    [1_234_567, '1.23M'],
    [-5, '0'],
    [Number.NaN, '0'],
    [Number.POSITIVE_INFINITY, '0']
  ])('formats %s → %s', (input, expected) => {
    expect(formatTokens(input)).toBe(expected)
  })
})
