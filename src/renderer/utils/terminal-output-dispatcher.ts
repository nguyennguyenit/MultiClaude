type TerminalOutputPayload = {
  terminalId: string
  data: string
}

type TerminalOutputHandler = (data: string) => void

const terminalOutputHandlers = new Map<string, TerminalOutputHandler>()

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
    terminalOutputHandlers.get(terminalId)?.(data)
  })
}

export function resetTerminalOutputDispatcherForTests(): void {
  terminalOutputHandlers.clear()
}
