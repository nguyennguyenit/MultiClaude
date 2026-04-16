import { joinPathsForTerminal } from '../utils/terminal-path-utils'

interface PendingToken {
  path: string
  displayLength: number
}

interface PendingMediaOps {
  flush: (terminalId: string) => string[]
  clear: (terminalId: string) => void
  getQueue: (
    terminalId: string
  ) => { tokens: PendingToken[]; charsAfterLastToken: number }
  decrementCharsAfter: (terminalId: string) => boolean
  incrementCharsAfter: (terminalId: string) => void
  popToken: (terminalId: string) => PendingToken | null
}

export interface OnDataHandlerOptions {
  terminalId: string
  write: (terminalId: string, data: string) => void
  writeDisplay: (text: string) => void
  followLiveOutput: () => void
  pending: PendingMediaOps
}

/**
 * Factory for the terminal onData handler with media-token intercept.
 * Extracted so it can be unit-tested without the xterm closure.
 */
export function createOnDataHandler({
  terminalId,
  write,
  writeDisplay,
  followLiveOutput,
  pending
}: OnDataHandlerOptions): (data: string) => void {
  return (data: string) => {
    followLiveOutput()

    // Ctrl+C — single-char
    if (data === '\x03') {
      pending.clear(terminalId)
      write(terminalId, data)
      return
    }

    // Backspace — single-char
    if (data === '\x7f') {
      const wasNormal = pending.decrementCharsAfter(terminalId)
      if (wasNormal) {
        write(terminalId, data)
        return
      }
      const token = pending.popToken(terminalId)
      if (token) {
        writeDisplay('\b \b'.repeat(token.displayLength))
        return
      }
      write(terminalId, data)
      return
    }

    // Multi-char data possibly containing \r (paste)
    if (data.includes('\r')) {
      const parts = data.split('\r')
      for (let i = 0; i < parts.length; i++) {
        const part = parts[i]
        if (part) {
          write(terminalId, part)
          // Track chars-after-token for the pre-\r segment (for in-line backspace later)
          const queue = pending.getQueue(terminalId)
          if (queue.tokens.length > 0) {
            for (let j = 0; j < part.length; j++) pending.incrementCharsAfter(terminalId)
          }
        }
        if (i < parts.length - 1) {
          const paths = pending.flush(terminalId)
          if (paths.length > 0) {
            const prefix = part ? ' ' : ''
            write(terminalId, prefix + joinPathsForTerminal(paths))
          }
          write(terminalId, '\r')
        }
      }
      return
    }

    // Regular chars / escape sequences / arrows etc.
    const queue = pending.getQueue(terminalId)
    if (queue.tokens.length > 0 && data >= ' ') {
      pending.incrementCharsAfter(terminalId)
    }
    write(terminalId, data)
  }
}
