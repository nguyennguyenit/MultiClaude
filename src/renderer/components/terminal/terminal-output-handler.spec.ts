import { describe, expect, it, vi } from 'vitest'
import { processTerminalOutputChunk } from './terminal-output-handler'

describe('processTerminalOutputChunk', () => {
  it('writes output and appends visible data when restore suppression is off', () => {
    const write = vi.fn().mockReturnValue('visible output')
    const onOutput = vi.fn()
    const appendOutput = vi.fn()

    processTerminalOutputChunk({
      terminalId: 'term-1',
      data: 'raw output',
      write,
      onOutput,
      skipAppend: false,
      appendOutput
    })

    expect(write).toHaveBeenCalledWith('raw output')
    expect(onOutput).toHaveBeenCalledOnce()
    expect(appendOutput).toHaveBeenCalledOnce()
    expect(appendOutput).toHaveBeenCalledWith('term-1', 'visible output')
  })

  it('still writes and emits output activity during restore suppression without appending', () => {
    const write = vi.fn().mockReturnValue('prompt redraw')
    const onOutput = vi.fn()
    const appendOutput = vi.fn()

    processTerminalOutputChunk({
      terminalId: 'term-1',
      data: 'raw output',
      write,
      onOutput,
      skipAppend: true,
      appendOutput
    })

    expect(write).toHaveBeenCalledWith('raw output')
    expect(onOutput).toHaveBeenCalledOnce()
    expect(appendOutput).not.toHaveBeenCalled()
  })

  it('skips appending empty visible output', () => {
    const appendOutput = vi.fn()

    processTerminalOutputChunk({
      terminalId: 'term-1',
      data: 'raw output',
      write: vi.fn().mockReturnValue(''),
      skipAppend: false,
      appendOutput
    })

    expect(appendOutput).not.toHaveBeenCalled()
  })
})
