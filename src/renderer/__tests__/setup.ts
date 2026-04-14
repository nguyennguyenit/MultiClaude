import { vi, beforeEach } from 'vitest'

beforeEach(() => {
  vi.clearAllMocks()

  // Stub window.electron for renderer tests
  vi.stubGlobal('electron', {
    terminal: {
      input: vi.fn(),
      resize: vi.fn(),
      showContextMenu: vi.fn(),
    },
    clipboard: { writeText: vi.fn() },
    shell: { openPath: vi.fn(), openExternal: vi.fn() },
  })

  // Stub matchMedia
  vi.stubGlobal('matchMedia', () => ({
    matches: false,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }))
})
