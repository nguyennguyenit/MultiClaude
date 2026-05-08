type TerminalOutputPayload = {
  terminalId: string
  data: string
}

type TerminalOutputHandler = (data: string) => void

const terminalOutputHandlers = new Map<string, TerminalOutputHandler>()

// Per-terminal buffer: when paused, incoming chunks are queued here instead of
// being forwarded to the handler.  On resume the queue is drained in arrival order.
const pausedBuffers = new Map<string, string[]>()

/**
 * Pause output dispatching for a terminal.
 * Subsequent incoming chunks are buffered until resumeAndFlush() is called.
 */
export function pauseAndBuffer(id: string): void {
  if (!pausedBuffers.has(id)) {
    pausedBuffers.set(id, [])
  }
}

/**
 * Resume output dispatching for a terminal.
 * Flushes buffered chunks to the registered handler in arrival order,
 * then resumes normal (unbuffered) dispatch.
 */
export function resumeAndFlush(id: string): void {
  const buffer = pausedBuffers.get(id)
  if (!buffer) return

  // Remove entry first so any re-entrant writes go direct to handler
  pausedBuffers.delete(id)

  const handler = terminalOutputHandlers.get(id)
  if (handler) {
    for (const chunk of buffer) {
      handler(chunk)
    }
  }
}

/**
 * EXPERIMENTAL: Drop buffered chunks and resume normal dispatch without flushing.
 * Used to test whether the buffered-flush after snapshot causes duplication
 * (snapshot already reflects those bytes via the headless mirror).
 */
export function discardAndResume(id: string): void {
  pausedBuffers.delete(id)
}

export function registerTerminalOutputHandler(id: string, handler: TerminalOutputHandler): () => void {
  terminalOutputHandlers.set(id, handler)

  return () => {
    if (terminalOutputHandlers.get(id) === handler) {
      terminalOutputHandlers.delete(id)
    }
  }
}

export function attachTerminalOutputDispatcher(
  subscribe: (callback: (payload: TerminalOutputPayload) => void) => () => void
): () => void {
  return subscribe(({ terminalId, data }) => {
    const buffer = pausedBuffers.get(terminalId)
    if (buffer) {
      buffer.push(data)
      return
    }
    terminalOutputHandlers.get(terminalId)?.(data)
  })
}

export function resetTerminalOutputDispatcherForTests(): void {
  terminalOutputHandlers.clear()
  pausedBuffers.clear()
}
