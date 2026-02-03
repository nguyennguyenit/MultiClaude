import { TERMINAL_FONTS } from '@shared/constants'
import type { TerminalFontId } from '@shared/types'

/**
 * Get CSS font-family string from font ID.
 * Returns fallback if font ID not found.
 */
export function getFontFamily(fontId?: TerminalFontId): string {
  if (!fontId) return "'JetBrains Mono', monospace"
  const font = TERMINAL_FONTS.find((f) => f.id === fontId)
  return font?.family ?? "'JetBrains Mono', monospace"
}
