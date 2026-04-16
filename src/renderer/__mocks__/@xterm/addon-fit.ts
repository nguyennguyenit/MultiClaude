import { vi } from 'vitest'
export const FitAddon = vi.fn(() => ({
  activate: vi.fn(),
  dispose: vi.fn(),
  fit: vi.fn(),
  proposeDimensions: vi.fn(() => ({ cols: 80, rows: 24 })),
}))
