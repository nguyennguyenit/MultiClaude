import { describe, expect, it } from 'vitest'
import { isPrimaryDeviceAttributesResponse } from '@shared/utils/terminal-protocol'
import { isTerminalProtocolResponse } from './terminal-input-utils'

describe('isTerminalProtocolResponse', () => {
  it('recognizes xterm primary device-attributes replies', () => {
    expect(isTerminalProtocolResponse('\x1b[?1;2c')).toBe(true)
    expect(isTerminalProtocolResponse('\x1b[>0;276;0c')).toBe(true)
    expect(isTerminalProtocolResponse('\x1b[0n')).toBe(true)
    expect(isTerminalProtocolResponse('\x1b[24;80R')).toBe(true)
    expect(isTerminalProtocolResponse('\x1b[?2026;1$y')).toBe(true)
    expect(isTerminalProtocolResponse('\x1b]11;rgb:1a1a/1b1b/2626\x1b\\')).toBe(true)
  })

  it('does not classify user keyboard input as a terminal response', () => {
    expect(isTerminalProtocolResponse('c')).toBe(false)
    expect(isTerminalProtocolResponse('\x1b[5;2~')).toBe(false)
  })

  it('distinguishes required primary device attributes from optional replies', () => {
    expect(isPrimaryDeviceAttributesResponse('\x1b[?1;2c')).toBe(true)
    expect(isPrimaryDeviceAttributesResponse('\x1b[>0;276;0c')).toBe(false)
    expect(isPrimaryDeviceAttributesResponse('\x1b]11;rgb:1a1a/1b1b/2626\x1b\\')).toBe(false)
  })
})
