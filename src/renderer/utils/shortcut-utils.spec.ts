import { describe, expect, it } from 'vitest'
import { getGlobalShortcut, shouldBypassXtermShortcut, type ShortcutEventLike } from './shortcut-utils'

function createEvent(overrides: Partial<ShortcutEventLike>): ShortcutEventLike {
  return {
    altKey: false,
    ctrlKey: false,
    metaKey: false,
    shiftKey: false,
    key: '',
    ...overrides
  }
}

describe('shortcut-utils', () => {
  it('resolves project switching from physical digit keys', () => {
    const shortcut = getGlobalShortcut(createEvent({
      altKey: true,
      key: '#',
      code: 'Digit3'
    }))

    expect(shortcut).toEqual({ type: 'switch-project', index: 2 })
  })

  it('falls back to key values when code is unavailable', () => {
    const shortcut = getGlobalShortcut(createEvent({
      altKey: true,
      key: '2'
    }))

    expect(shortcut).toEqual({ type: 'switch-project', index: 1 })
  })

  it('maps command shortcuts used by the global handler', () => {
    expect(getGlobalShortcut(createEvent({
      metaKey: true,
      key: 'n',
      code: 'KeyN'
    }))).toEqual({ type: 'new-terminal' })

    expect(getGlobalShortcut(createEvent({
      ctrlKey: true,
      key: 'g',
      code: 'KeyG'
    }))).toEqual({ type: 'toggle-github-panel' })

    expect(getGlobalShortcut(createEvent({
      ctrlKey: true,
      key: 'b',
      code: 'KeyB'
    }))).toBeNull()
  })

  it('marks terminal-hosted global shortcuts for xterm bypass', () => {
    expect(shouldBypassXtermShortcut(createEvent({
      altKey: true,
      key: '1',
      code: 'Digit1'
    }))).toBe(true)

    expect(shouldBypassXtermShortcut(createEvent({
      ctrlKey: true,
      key: 'w',
      code: 'KeyW'
    }))).toBe(true)
  })

  it('ignores regular typing', () => {
    const shortcut = getGlobalShortcut(createEvent({
      key: 'a',
      code: 'KeyA'
    }))

    expect(shortcut).toBeNull()
    expect(shouldBypassXtermShortcut(createEvent({
      key: 'v',
      code: 'KeyV'
    }))).toBe(false)
  })
})
