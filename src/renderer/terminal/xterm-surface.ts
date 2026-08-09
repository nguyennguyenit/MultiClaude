import type { Terminal as XTerm } from '@xterm/xterm'
import type { TerminalSnapshot } from '@shared/types'
import type { TerminalSurface, TerminalSurfaceCapabilities } from './terminal-surface'

export class XtermSurface implements TerminalSurface {
  readonly capabilities: TerminalSurfaceCapabilities = {
    selection: true,
    clipboard: true,
    imeComposition: true,
  }
  private readonly listenerCleanup = new Set<() => void>()

  constructor(private readonly terminal: XTerm) {}

  mount(container: HTMLElement): void {
    this.terminal.open(container)
  }

  write(data: string): Promise<void> {
    return new Promise(resolve => this.terminal.write(data, resolve))
  }

  async replaceSnapshot(snapshot: TerminalSnapshot): Promise<void> {
    this.terminal.reset()
    if (snapshot.cols > 0 && snapshot.rows > 0) {
      this.terminal.resize(snapshot.cols, snapshot.rows)
    }
    if (snapshot.ansi) await this.write(snapshot.ansi)
  }

  resize(cols: number, rows: number): void {
    this.terminal.resize(cols, rows)
  }

  focus(): void {
    this.terminal.focus()
  }

  getSelection(): string {
    return this.terminal.getSelection()
  }

  onInput(listener: (data: string) => void): () => void {
    const disposable = this.terminal.onData(listener)
    const cleanup = () => {
      disposable.dispose()
      this.listenerCleanup.delete(cleanup)
    }
    this.listenerCleanup.add(cleanup)
    return cleanup
  }

  onComposition(listener: (active: boolean) => void): () => void {
    const textarea = this.terminal.textarea
    if (!textarea) return () => undefined
    const start = () => listener(true)
    const end = () => listener(false)
    textarea.addEventListener('compositionstart', start)
    textarea.addEventListener('compositionend', end)
    const cleanup = () => {
      textarea.removeEventListener('compositionstart', start)
      textarea.removeEventListener('compositionend', end)
      this.listenerCleanup.delete(cleanup)
    }
    this.listenerCleanup.add(cleanup)
    return cleanup
  }

  onResize(listener: (cols: number, rows: number) => void): () => void {
    const disposable = this.terminal.onResize(({ cols, rows }) => listener(cols, rows))
    const cleanup = () => {
      disposable.dispose()
      this.listenerCleanup.delete(cleanup)
    }
    this.listenerCleanup.add(cleanup)
    return cleanup
  }

  dispose(): void {
    for (const cleanup of [...this.listenerCleanup]) cleanup()
    this.terminal.dispose()
  }
}
