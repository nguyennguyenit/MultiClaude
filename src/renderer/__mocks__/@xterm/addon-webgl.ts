import { vi } from 'vitest'
export const WebglAddon = vi.fn(() => ({
  activate: vi.fn(),
  dispose: vi.fn(),
  onContextLoss: vi.fn(() => ({ dispose: vi.fn() })),
  onChangeTextureAtlas: vi.fn(() => ({ dispose: vi.fn() })),
}))
