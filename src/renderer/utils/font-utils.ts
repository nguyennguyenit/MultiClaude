import { getTerminalFontFamilyById } from '@shared/constants'
import type { TerminalFontId } from '@shared/types'

/**
 * Get CSS font-family string from font ID.
 * Returns fallback if font ID not found.
 */
export function getFontFamily(fontId?: TerminalFontId): string {
  return getTerminalFontFamilyById(fontId)
}
