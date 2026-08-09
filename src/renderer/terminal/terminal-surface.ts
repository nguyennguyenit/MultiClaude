import type { TerminalSnapshot } from '@shared/types'

export interface TerminalSurfaceCapabilities {
  selection: boolean
  clipboard: boolean
  imeComposition: boolean
}

export interface TerminalSurface {
  readonly capabilities: TerminalSurfaceCapabilities
  mount(container: HTMLElement): void
  write(data: string): Promise<void>
  replaceSnapshot(snapshot: TerminalSnapshot): Promise<void>
  resize(cols: number, rows: number): void
  focus(): void
  getSelection(): string
  onInput(listener: (data: string) => void): () => void
  onComposition(listener: (active: boolean) => void): () => void
  onResize(listener: (cols: number, rows: number) => void): () => void
  dispose(): void
}
