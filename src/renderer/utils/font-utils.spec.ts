import { describe, expect, it } from 'vitest'
import { getFontFamily } from './font-utils'

describe('getFontFamily', () => {
  it('builds a terminal stack with symbol fallbacks for Claude Code glyphs', () => {
    const stack = getFontFamily('jetbrains-mono')

    expect(stack).toContain("'JetBrains Mono'")
    expect(stack).toContain("'Symbols Nerd Font Mono'")
    expect(stack).toContain("'Apple Symbols'")
  })

  it('falls back to JetBrains Mono stack for unknown font ids', () => {
    const stack = getFontFamily('unknown-font' as never)

    expect(stack).toContain("'JetBrains Mono'")
    expect(stack).toContain('monospace')
  })
})
