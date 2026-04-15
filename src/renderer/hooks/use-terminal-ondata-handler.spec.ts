import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createOnDataHandler, type OnDataHandlerOptions } from './use-terminal-ondata-handler'

describe('createOnDataHandler', () => {
  const terminalId = 't1'
  let write: ReturnType<typeof vi.fn>
  let writeDisplay: ReturnType<typeof vi.fn>
  let followLiveOutput: ReturnType<typeof vi.fn>
  let flush: ReturnType<typeof vi.fn>
  let clear: ReturnType<typeof vi.fn>
  let getQueue: ReturnType<typeof vi.fn>
  let decrementCharsAfter: ReturnType<typeof vi.fn>
  let incrementCharsAfter: ReturnType<typeof vi.fn>
  let popToken: ReturnType<typeof vi.fn>
  let handler: (data: string) => void

  beforeEach(() => {
    write = vi.fn()
    writeDisplay = vi.fn()
    followLiveOutput = vi.fn()
    flush = vi.fn(() => [])
    clear = vi.fn()
    getQueue = vi.fn(() => ({ tokens: [], charsAfterLastToken: 0 }))
    decrementCharsAfter = vi.fn(() => false)
    incrementCharsAfter = vi.fn()
    popToken = vi.fn(() => null)

    handler = createOnDataHandler({
      terminalId,
      write: write as unknown as (id: string, data: string) => void,
      writeDisplay: writeDisplay as unknown as (t: string) => void,
      followLiveOutput: followLiveOutput as unknown as () => void,
      pending: {
        flush: flush as unknown as (id: string) => string[],
        clear: clear as unknown as (id: string) => void,
        getQueue: getQueue as unknown as OnDataHandlerOptions['pending']['getQueue'],
        decrementCharsAfter: decrementCharsAfter as unknown as (id: string) => boolean,
        incrementCharsAfter: incrementCharsAfter as unknown as (id: string) => void,
        popToken: popToken as unknown as OnDataHandlerOptions['pending']['popToken']
      }
    })
  })

  describe('Enter (\\r)', () => {
    it('flushes pending paths before \\r', () => {
      flush.mockReturnValue(['/a.png', '/b.mp4'])
      handler('\r')
      expect(write).toHaveBeenNthCalledWith(1, terminalId, '/a.png /b.mp4')
      expect(write).toHaveBeenNthCalledWith(2, terminalId, '\r')
    })

    it('writes \\r directly when no pending paths', () => {
      handler('\r')
      expect(write).toHaveBeenCalledOnce()
      expect(write).toHaveBeenCalledWith(terminalId, '\r')
    })

    it('handles \\r in multi-char paste data', () => {
      flush.mockReturnValue(['/a.png'])
      handler('hello\rworld')
      // hello, space+path, \r, world
      expect(write).toHaveBeenCalledWith(terminalId, 'hello')
      expect(write).toHaveBeenCalledWith(terminalId, ' /a.png')
      expect(write).toHaveBeenCalledWith(terminalId, '\r')
      expect(write).toHaveBeenCalledWith(terminalId, 'world')
    })
  })

  describe('Ctrl+C', () => {
    it('clears pending and writes to PTY', () => {
      handler('\x03')
      expect(clear).toHaveBeenCalledWith(terminalId)
      expect(write).toHaveBeenCalledWith(terminalId, '\x03')
    })
  })

  describe('Backspace', () => {
    it('normal backspace when charsAfterLastToken > 0', () => {
      decrementCharsAfter.mockReturnValue(true)
      handler('\x7f')
      expect(write).toHaveBeenCalledWith(terminalId, '\x7f')
      expect(popToken).not.toHaveBeenCalled()
    })

    it('erases token from display when charsAfterLastToken = 0', () => {
      decrementCharsAfter.mockReturnValue(false)
      popToken.mockReturnValue({ path: '/a.png', displayLength: 9 })
      handler('\x7f')
      expect(writeDisplay).toHaveBeenCalledWith('\b \b'.repeat(9))
      expect(write).not.toHaveBeenCalled()
    })

    it('normal backspace when no pending tokens', () => {
      handler('\x7f')
      expect(write).toHaveBeenCalledWith(terminalId, '\x7f')
    })
  })

  describe('Regular chars', () => {
    it('increments charsAfterLastToken when tokens pending', () => {
      getQueue.mockReturnValue({
        tokens: [{ path: '/a.png', displayLength: 9 }],
        charsAfterLastToken: 0
      })
      handler('a')
      expect(incrementCharsAfter).toHaveBeenCalledWith(terminalId)
      expect(write).toHaveBeenCalledWith(terminalId, 'a')
    })

    it('does not track chars when no pending tokens', () => {
      handler('a')
      expect(incrementCharsAfter).not.toHaveBeenCalled()
    })

    it('calls followLiveOutput on every input', () => {
      handler('a')
      expect(followLiveOutput).toHaveBeenCalled()
    })
  })
})
