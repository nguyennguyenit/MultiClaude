import { vi } from 'vitest'

type ScrollCallback = (viewportY: number) => void
const scrollCallbacks: ScrollCallback[] = []

export const mockTerminalInstance = {
  open: vi.fn(),
  write: vi.fn((_data: unknown, cb?: () => void) => cb?.()),
  dispose: vi.fn(),
  loadAddon: vi.fn(),
  focus: vi.fn(),
  blur: vi.fn(),
  onScroll: vi.fn((cb: ScrollCallback) => {
    scrollCallbacks.push(cb)
    return { dispose: vi.fn() }
  }),
  onData: vi.fn(() => ({ dispose: vi.fn() })),
  onSelectionChange: vi.fn(() => ({ dispose: vi.fn() })),
  onWriteParsed: vi.fn(() => ({ dispose: vi.fn() })), // v6 new API
  buffer: { active: { viewportY: 0, baseY: 0 } },
  element: null as HTMLElement | null,
  scrollToBottom: vi.fn(),
  scrollToLine: vi.fn(),
  scrollLines: vi.fn(),
  getSelection: vi.fn(() => ''),
  clearSelection: vi.fn(),
  select: vi.fn(),
  options: {} as Record<string, unknown>,
  rows: 24,
  cols: 80,
}

/** Test helper: simulate a scroll event at given viewportY */
export function triggerScroll(viewportY: number) {
  mockTerminalInstance.buffer.active.viewportY = viewportY
  scrollCallbacks.forEach(cb => cb(viewportY))
}

export const Terminal = vi.fn(() => mockTerminalInstance)
export type IDisposable = { dispose: () => void }
export type IEvent<T> = (listener: (arg: T) => void) => IDisposable
