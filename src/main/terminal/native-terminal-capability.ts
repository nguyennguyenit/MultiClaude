import type { TerminalEngine } from '@shared/types'

export interface NativeTerminalCapability {
  engine: 'ghostty'
  platform: NodeJS.Platform
  available: boolean
  reason: string
}

export function getNativeTerminalCapability(
  platform: NodeJS.Platform = process.platform,
): NativeTerminalCapability {
  if (platform !== 'darwin') {
    return {
      engine: 'ghostty',
      platform,
      available: false,
      reason: 'GhosttyKit is supported only on macOS.',
    }
  }
  return {
    engine: 'ghostty',
    platform,
    available: false,
    reason: 'The GhosttyKit backend is not included in this build.',
  }
}

export function resolveTerminalEngine(
  requested: TerminalEngine | undefined,
  capability = getNativeTerminalCapability(),
): TerminalEngine {
  return requested === 'ghostty' &&
    capability.platform === 'darwin' &&
    capability.available
    ? 'ghostty'
    : 'xterm'
}
