/**
 * Format a token count for compact display.
 *   < 1k        → "123"
 *   1k – 1M     → "1.2k"
 *   ≥ 1M        → "1.23M"
 * Negative or non-finite inputs collapse to "0".
 */
export function formatTokens(n: number): string {
  if (!Number.isFinite(n) || n < 0) return '0'
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`
  return String(Math.trunc(n))
}
