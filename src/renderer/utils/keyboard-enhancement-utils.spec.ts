import { describe, expect, it } from 'vitest'
import {
  INITIAL_KEYBOARD_ENHANCEMENT_STATE,
  getCsiUEnterSequence,
  isTerminalKeyboardEnhancementEnabled,
  processTerminalKeyboardEnhancementData
} from './keyboard-enhancement-utils'

describe('keyboard-enhancement-utils', () => {
  it('responds to keyboard enhancement queries without leaking control sequences into output', () => {
    const result = processTerminalKeyboardEnhancementData('\x1b[?uhello', INITIAL_KEYBOARD_ENHANCEMENT_STATE)

    expect(result.visibleData).toBe('hello')
    expect(result.responses).toEqual(['\x1b[?0u'])
    expect(result.nextState).toEqual({
      supported: true,
      flags: 0,
      stack: [],
      pendingSequence: ''
    })
  })

  it('tracks pushed flags and restores them on pop', () => {
    const pushed = processTerminalKeyboardEnhancementData('\x1b[>9u', INITIAL_KEYBOARD_ENHANCEMENT_STATE)
    const popped = processTerminalKeyboardEnhancementData('\x1b[<1u', pushed.nextState)

    expect(isTerminalKeyboardEnhancementEnabled(pushed.nextState)).toBe(true)
    expect(pushed.nextState.supported).toBe(true)
    expect(pushed.nextState.flags).toBe(9)
    expect(popped.nextState).toEqual({
      supported: true,
      flags: 0,
      stack: [],
      pendingSequence: ''
    })
  })

  it('buffers partial sequences across chunks', () => {
    const firstChunk = processTerminalKeyboardEnhancementData('\x1b[>9', INITIAL_KEYBOARD_ENHANCEMENT_STATE)
    const secondChunk = processTerminalKeyboardEnhancementData('uOK', firstChunk.nextState)

    expect(firstChunk.visibleData).toBe('')
    expect(firstChunk.nextState.pendingSequence).toBe('\x1b[>9')
    expect(secondChunk.visibleData).toBe('OK')
    expect(secondChunk.nextState.flags).toBe(9)
  })

  it('encodes only Shift+Enter as a CSI u sequence', () => {
    expect(getCsiUEnterSequence({
      shiftKey: true,
      altKey: false,
      ctrlKey: false,
      metaKey: false
    })).toBe('\x1b[13;2u')

    expect(getCsiUEnterSequence({
      shiftKey: false,
      altKey: false,
      ctrlKey: true,
      metaKey: false
    })).toBeNull()

    expect(getCsiUEnterSequence({
      shiftKey: false,
      altKey: false,
      ctrlKey: false,
      metaKey: false
    })).toBeNull()
  })
})
