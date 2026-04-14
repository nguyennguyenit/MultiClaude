import { describe, expect, it } from 'vitest'
import { stripLeakedTerminalResponses } from './terminal-output-utils'

describe('terminal-output-utils', () => {
  // CPR – Cursor Position Report
  it('strips standalone leaked cursor position reports from output', () => {
    expect(stripLeakedTerminalResponses('before\r\n[3;37R[3;37R\r\nafter')).toBe('before\r\nafter')
  })

  it('strips leaked cursor position reports even when a prompt marker prefixes the artifact line', () => {
    expect(stripLeakedTerminalResponses('before\r\n> [3;37R[3;37R\r\nafter')).toBe('before\r\nafter')
  })

  it('strips CPR responses that include the ESC prefix', () => {
    expect(stripLeakedTerminalResponses('before\r\n\x1b[3;36R\r\nafter')).toBe('before\r\nafter')
  })

  it('keeps ordinary bracketed text untouched', () => {
    expect(stripLeakedTerminalResponses('status [3;37R is part of this sentence]')).toBe('status [3;37R is part of this sentence]')
  })

  // OSC 11 – background color query response (ST = ESC \)
  it('strips OSC 11 background-color response terminated with ESC \\', () => {
    expect(stripLeakedTerminalResponses('before\x1b]11;rgb:0d0d/1111/1717\x1b\\after')).toBe('beforeafter')
  })

  // OSC 11 – background color query response (ST = BEL)
  it('strips OSC 11 background-color response terminated with BEL', () => {
    expect(stripLeakedTerminalResponses('before\x1b]11;rgb:ffff/ffff/ffff\x07after')).toBe('beforeafter')
  })

  // DA – Primary Device Attributes response
  it('strips Primary Device Attributes response', () => {
    expect(stripLeakedTerminalResponses('before\x1b[?1;2cafter')).toBe('beforeafter')
  })

  it('strips multiple mixed leaked sequences', () => {
    const input = '\x1b]11;rgb:0d0d/1111/1717\x1b\\\x1b[?1;2c\r\n\x1b[3;1R\r\ntext'
    expect(stripLeakedTerminalResponses(input)).toBe('\r\ntext')
  })
})
