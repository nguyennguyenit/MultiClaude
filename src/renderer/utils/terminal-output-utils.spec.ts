import { describe, expect, it } from 'vitest'
import { stripLeakedTerminalResponses } from './terminal-output-utils'

describe('terminal-output-utils', () => {
  it('strips standalone leaked cursor position reports from output', () => {
    expect(stripLeakedTerminalResponses('before\r\n[3;37R[3;37R\r\nafter')).toBe('before\r\nafter')
  })

  it('strips leaked cursor position reports even when a prompt marker prefixes the artifact line', () => {
    expect(stripLeakedTerminalResponses('before\r\n> [3;37R[3;37R\r\nafter')).toBe('before\r\nafter')
  })

  it('keeps ordinary bracketed text untouched', () => {
    expect(stripLeakedTerminalResponses('status [3;37R is part of this sentence]')).toBe('status [3;37R is part of this sentence]')
  })
})
