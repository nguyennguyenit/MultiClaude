import { beforeEach, describe, expect, it, vi } from 'vitest'
import { resolvePreferredDropTerminalId, writePathsToTerminal } from './file-drop-handler'

describe('file-drop-handler', () => {
  beforeEach(() => {
    vi.unstubAllGlobals()
  })

  it('prefers the drag target terminal over the active terminal', () => {
    expect(resolvePreferredDropTerminalId('terminal-active', 'terminal-hovered')).toBe('terminal-hovered')
    expect(resolvePreferredDropTerminalId('terminal-active', null)).toBe('terminal-active')
    expect(resolvePreferredDropTerminalId(null, null)).toBeNull()
  })

  it('writes formatted file paths into the requested terminal', () => {
    const write = vi.fn()

    vi.stubGlobal('window', {
      electron: {
        terminal: { write }
      }
    })

    writePathsToTerminal('terminal-2', ['/tmp/needs quotes/image 1.png', '/tmp/plain.png'])

    expect(write).toHaveBeenCalledWith(
      'terminal-2',
      '"/tmp/needs quotes/image 1.png" /tmp/plain.png'
    )
  })
})
