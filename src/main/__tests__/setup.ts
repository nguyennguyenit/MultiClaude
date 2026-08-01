import { vi } from 'vitest'

// Mock electron-store globally
vi.mock('electron-store', () => {
  const persistedByCwd = new Map<string, Record<string, unknown>>()
  return {
    default: class MockStore {
      private data: Record<string, unknown> = {}

      constructor(options?: { defaults?: Record<string, unknown>; cwd?: string }) {
        if (options?.cwd && persistedByCwd.has(options.cwd)) {
          this.data = persistedByCwd.get(options.cwd)!
        } else {
          this.data = { ...options?.defaults }
          if (options?.cwd) persistedByCwd.set(options.cwd, this.data)
        }
      }

      get(key: string) {
        return this.data[key]
      }

      set(key: string, value: unknown) {
        this.data[key] = value
      }
    }
  }
})

// Mock node-pty for terminal tests
vi.mock('@lydell/node-pty', () => ({
  spawn: vi.fn(() => ({
    onData: vi.fn(),
    onExit: vi.fn(),
    write: vi.fn(),
    resize: vi.fn(),
    kill: vi.fn()
  }))
}))
