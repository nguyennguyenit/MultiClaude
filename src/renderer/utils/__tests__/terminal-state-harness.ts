import headlessPkg from '@xterm/headless'
import type { Terminal as HeadlessTerminal } from '@xterm/headless'
import { SerializeAddon } from '@xterm/addon-serialize'

const { Terminal: HeadlessTerminalCtor } = headlessPkg

export interface ComparableTerminalState {
  data: string
  cols: number
  rows: number
  cursorX: number
  cursorY: number
  bufferType: string
}

export interface TerminalStateHarness {
  terminal: HeadlessTerminal
  write(data: string): Promise<void>
  reset(): void
  state(): ComparableTerminalState
  dispose(): void
}

export function createTerminalStateHarness(cols = 80, rows = 24): TerminalStateHarness {
  const terminal = new HeadlessTerminalCtor({
    cols,
    rows,
    scrollback: 20_000,
    allowProposedApi: true,
  })
  const serializer = new SerializeAddon()
  terminal.loadAddon(serializer as unknown as Parameters<typeof terminal.loadAddon>[0])

  return {
    terminal,
    write(data) {
      return new Promise<void>((resolve) => terminal.write(data, resolve))
    },
    reset() {
      terminal.reset()
    },
    state() {
      return {
        data: serializer.serialize({ scrollback: 20_000 }),
        cols: terminal.cols,
        rows: terminal.rows,
        cursorX: terminal.buffer.active.cursorX,
        cursorY: terminal.buffer.active.cursorY,
        bufferType: terminal.buffer.active.type,
      }
    },
    dispose() {
      terminal.dispose()
    },
  }
}

export function deferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void
  let reject!: (reason?: unknown) => void
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise
    reject = rejectPromise
  })
  return { promise, resolve, reject }
}
