import { vi } from 'vitest'
export const WebLinksAddon = vi.fn(() => ({
  activate: vi.fn(),
  dispose: vi.fn(),
}))
