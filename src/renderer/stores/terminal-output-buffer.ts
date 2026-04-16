import { TERMINAL_OUTPUT_BUFFER_MAX, TERMINAL_OUTPUT_BUFFER_TRIM_TO } from '@shared/constants'

const terminalOutputBuffers = new Map<string, string>()

export function getBufferedTerminalOutput(id: string): string {
  return terminalOutputBuffers.get(id) ?? ''
}

export function appendBufferedTerminalOutput(id: string, data: string): void {
  const nextOutput = getBufferedTerminalOutput(id) + data
  terminalOutputBuffers.set(
    id,
    nextOutput.length > TERMINAL_OUTPUT_BUFFER_MAX
      ? nextOutput.slice(-TERMINAL_OUTPUT_BUFFER_TRIM_TO)
      : nextOutput
  )
}

export function clearBufferedTerminalOutput(id: string): void {
  terminalOutputBuffers.delete(id)
}

export function resetBufferedTerminalOutputForTests(): void {
  terminalOutputBuffers.clear()
}
