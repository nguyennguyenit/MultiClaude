const writers = new Map<string, (text: string) => void>()

export function registerDisplayWriter(
  terminalId: string,
  writer: (text: string) => void
): () => void {
  writers.set(terminalId, writer)
  return () => {
    if (writers.get(terminalId) === writer) {
      writers.delete(terminalId)
    }
  }
}

export function writeToDisplay(terminalId: string, text: string): void {
  writers.get(terminalId)?.(text)
}

export function unregisterDisplayWriter(terminalId: string): void {
  writers.delete(terminalId)
}

export function clearAllWriters(): void {
  writers.clear()
}
