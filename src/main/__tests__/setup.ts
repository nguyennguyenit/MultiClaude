import { vi } from 'vitest'

// Mock electron-store globally
vi.mock('electron-store', () => {
  return {
    default: class MockStore {
      private data: Record<string, unknown> = {}

      constructor(options?: { defaults?: Record<string, unknown> }) {
        if (options?.defaults) {
          this.data = { ...options.defaults }
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
