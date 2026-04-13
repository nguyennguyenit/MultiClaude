interface ProcessTerminalOutputChunkParams {
  terminalId: string
  data: string
  write: (data: string) => string
  onOutput?: () => void
  skipAppend: boolean
  appendOutput: (terminalId: string, data: string) => void
}

export function processTerminalOutputChunk({
  terminalId,
  data,
  write,
  onOutput,
  skipAppend,
  appendOutput
}: ProcessTerminalOutputChunkParams): string {
  const visibleData = write(data)
  onOutput?.()

  if (!skipAppend && visibleData) {
    appendOutput(terminalId, visibleData)
  }

  return visibleData
}
