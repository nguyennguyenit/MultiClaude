import { describe, expect, it } from 'vitest'
import {
  getNativeTerminalCapability,
  resolveTerminalEngine,
} from '../native-terminal-capability'

describe('native terminal capability', () => {
  it('defaults to unavailable until the native backend is shipped', () => {
    expect(getNativeTerminalCapability('darwin')).toMatchObject({
      available: false,
      engine: 'ghostty',
    })
  })

  it.each(['win32', 'linux'] as const)('normalizes Ghostty to xterm on %s', (platform) => {
    const capability = getNativeTerminalCapability(platform)
    expect(resolveTerminalEngine('ghostty', capability)).toBe('xterm')
  })

  it('rejects an inconsistent available capability on non-macOS platforms', () => {
    expect(
      resolveTerminalEngine('ghostty', {
        engine: 'ghostty',
        platform: 'linux',
        available: true,
        reason: 'invalid injected capability',
      }),
    ).toBe('xterm')
  })
})
