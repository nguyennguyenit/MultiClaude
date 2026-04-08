import { describe, it, expect } from 'vitest'
import { cleanTerminalOutput } from '../terminal-output-cleaner'

describe('cleanTerminalOutput', () => {
  it('strips standard CSI color/style sequences', () => {
    expect(cleanTerminalOutput('\x1b[31mred text\x1b[0m')).toBe('red text')
  })

  it('strips private mode sequences (bracketed paste, etc.)', () => {
    // \x1b[?2004h = bracketed paste on, \x1b[?2026h = synchronized output
    expect(cleanTerminalOutput('\x1b[?2004hsome output\x1b[?2004l')).toBe('some output')
    expect(cleanTerminalOutput('\x1b[?2026h\x1b[?2031h\x1b[=0u\x1b[?2026l')).toBe('')
  })

  it('strips OSC sequences (window title, etc.)', () => {
    expect(cleanTerminalOutput('\x1b]0;My Title\x07normal text')).toBe('normal text')
    expect(cleanTerminalOutput('\x1b]0;title\x1b\\normal text')).toBe('normal text')
  })

  it('strips DCS/APC sequences', () => {
    expect(cleanTerminalOutput('\x1bPsome dcs\x1b\\visible')).toBe('visible')
  })

  it('strips single-char ESC sequences', () => {
    // \x1b= application keypad, \x1b> normal keypad, \x1bM cursor up
    expect(cleanTerminalOutput('\x1b=\x1b>text\x1bM')).toBe('text')
  })

  it('normalizes CRLF to LF', () => {
    expect(cleanTerminalOutput('line1\r\nline2\r\nline3')).toBe('line1\nline2\nline3')
  })

  it('normalizes bare CR to LF', () => {
    expect(cleanTerminalOutput('line1\rline2')).toBe('line1\nline2')
  })

  it('expands tabs to 4 spaces', () => {
    expect(cleanTerminalOutput('col1\tcol2')).toBe('col1    col2')
  })

  it('filters blank lines', () => {
    expect(cleanTerminalOutput('line1\n\n\nline2\n   \nline3')).toBe('line1\nline2\nline3')
  })

  it('handles mixed real-world PTY output with prompt sequences', () => {
    const raw =
      '\x1b[?2004h\x1b[?2026h\x1b[?2031h\x1b[=0u' +
      '## What Was Done Well\n' +
      'Change is as small as it needs to be\n' +
      '\x1b[?2004l'
    expect(cleanTerminalOutput(raw)).toBe('## What Was Done Well\nChange is as small as it needs to be')
  })

  it('returns empty string for input with only escape sequences', () => {
    expect(cleanTerminalOutput('\x1b[?2004h\x1b[?2026h\r\n')).toBe('')
  })

  it('preserves readable text content', () => {
    expect(cleanTerminalOutput('Hello, world!')).toBe('Hello, world!')
  })
})
