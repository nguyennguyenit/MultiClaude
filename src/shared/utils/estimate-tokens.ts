import { Tiktoken } from 'js-tiktoken/lite'
import o200kBase from 'js-tiktoken/ranks/o200k_base'

/**
 * Lazy-initialized tiktoken encoder. Uses `o200k_base` — Claude's tokenizer is
 * not public; o200k_base is the best open approximation for mixed-language
 * content (ASCII, Vietnamese, CJK, emoji). Target accuracy ±5-10% vs Claude.
 *
 * Falls back to `Math.ceil(text.length / 4)` if encoder init fails.
 */
let encoder: Tiktoken | null = null
let encoderFailed = false

function getEncoder(): Tiktoken | null {
  if (encoder) return encoder
  if (encoderFailed) return null
  try {
    encoder = new Tiktoken(o200kBase)
    return encoder
  } catch (err) {
    console.warn('[estimate-tokens] encoder init failed, using fallback', err)
    encoderFailed = true
    return null
  }
}

/**
 * Estimate token count for a string. Safe for null/undefined/empty inputs.
 * Uses tiktoken o200k_base when available, chars/4 heuristic otherwise.
 */
export function estimateTokens(text: string | null | undefined): number {
  if (!text) return 0
  const enc = getEncoder()
  if (enc) {
    try {
      return enc.encode(text).length
    } catch {
      // Encoder failures on very large inputs — fall through to heuristic
    }
  }
  return Math.ceil(text.length / 4)
}

/** For tests: force fallback path by resetting encoder state. */
export function __resetEncoderForTests(forceFail = false): void {
  encoder = null
  encoderFailed = forceFail
}

