import { beforeEach, describe, expect, it } from 'vitest'
import { TERMINAL_OUTPUT_BUFFER_MAX, TERMINAL_OUTPUT_BUFFER_TRIM_TO } from '@shared/constants'
import {
  appendBufferedTerminalOutput,
  clearBufferedTerminalOutput,
  getBufferedTerminalOutput,
  resetBufferedTerminalOutputForTests
} from './terminal-output-buffer'

describe('terminal-output-buffer', () => {
  beforeEach(() => {
    resetBufferedTerminalOutputForTests()
  })

  it('returns empty string for unknown terminal id', () => {
    expect(getBufferedTerminalOutput('missing-terminal')).toBe('')
  })

  it('appends chunks and returns concatenated output', () => {
    appendBufferedTerminalOutput('term-1', 'hello ')
    appendBufferedTerminalOutput('term-1', 'world')

    expect(getBufferedTerminalOutput('term-1')).toBe('hello world')
  })

  it('trims oversized output to TERMINAL_OUTPUT_BUFFER_TRIM_TO', () => {
    appendBufferedTerminalOutput('term-1', 'x'.repeat(TERMINAL_OUTPUT_BUFFER_MAX + 25))

    expect(getBufferedTerminalOutput('term-1')).toHaveLength(TERMINAL_OUTPUT_BUFFER_TRIM_TO)
  })

  it('clears one terminal without affecting another', () => {
    appendBufferedTerminalOutput('term-1', 'first')
    appendBufferedTerminalOutput('term-2', 'second')

    clearBufferedTerminalOutput('term-1')

    expect(getBufferedTerminalOutput('term-1')).toBe('')
    expect(getBufferedTerminalOutput('term-2')).toBe('second')
  })

  it('reset helper clears all buffered output', () => {
    appendBufferedTerminalOutput('term-1', 'first')
    appendBufferedTerminalOutput('term-2', 'second')

    resetBufferedTerminalOutputForTests()

    expect(getBufferedTerminalOutput('term-1')).toBe('')
    expect(getBufferedTerminalOutput('term-2')).toBe('')
  })
})
