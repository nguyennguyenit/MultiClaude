type TerminalOutputPayload = {
  terminalId: string
  data: string
  startOffset?: number
  endOffset?: number
}

type TerminalOutputHandler = (data: string) => void

const terminalOutputHandlers = new Map<string, TerminalOutputHandler>()

// Per-terminal buffer: when paused, incoming chunks are queued here instead of
// being forwarded to the handler.  On resume the queue is drained in arrival order.
const pausedBuffers = new Map<string, TerminalOutputPayload[]>()

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
interface ResumeAndFlushOptions {
  /**
   * Drop buffered bytes that are already represented by a backend snapshot.
   * Offsets use the main-process terminal output stream's string-length counter.
   */
  afterOffset?: number
}

function sliceAfterOffset(payload: TerminalOutputPayload, afterOffset: number | undefined): string {
  if (
    afterOffset === undefined ||
    payload.startOffset === undefined ||
    payload.endOffset === undefined
  ) {
    return payload.data
  }

  if (payload.endOffset <= afterOffset) return ''
  if (payload.startOffset >= afterOffset) return payload.data
  return payload.data.slice(afterOffset - payload.startOffset)
}

export function resumeAndFlush(id: string, options: ResumeAndFlushOptions = {}): void {
  const buffer = pausedBuffers.get(id)
  if (!buffer) return

  // Remove entry first so any re-entrant writes go direct to handler
  pausedBuffers.delete(id)

  const handler = terminalOutputHandlers.get(id)
  if (handler) {
    for (const payload of buffer) {
      const chunk = sliceAfterOffset(payload, options.afterOffset)
      if (chunk) handler(chunk)
    }
  }
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
  return subscribe((payload) => {
    const buffer = pausedBuffers.get(payload.terminalId)
    if (buffer) {
      buffer.push(payload)
      return
    }
    terminalOutputHandlers.get(payload.terminalId)?.(payload.data)
  })
}

export function resetTerminalOutputDispatcherForTests(): void {
  terminalOutputHandlers.clear()
  pausedBuffers.clear()
}
