import { describe, expect, it } from 'vitest'
import { createUserScrollIntent, resolveViewportRestoreTarget, TERMINAL_SCROLL_THRESHOLD } from './terminal-scroll-utils'

describe('terminal-scroll-utils', () => {
  it('keeps user attached to live output when they scroll back to bottom', () => {
    expect(createUserScrollIntent(120, 117, TERMINAL_SCROLL_THRESHOLD)).toEqual({
      viewportY: null,
      stickToBottom: true
    })
  })

  it('preserves explicit viewport position when user is still reading history', () => {
    expect(createUserScrollIntent(120, 88, TERMINAL_SCROLL_THRESHOLD)).toEqual({
      viewportY: 88,
      stickToBottom: false
    })
  })

  it('prioritizes user scroll intent over the stale write snapshot', () => {
    expect(resolveViewportRestoreTarget({
      wasAtBottom: false,
      savedViewportY: 40,
      pendingUserScrollIntent: {
        viewportY: 75,
        stickToBottom: false
      }
    })).toBe(75)
  })

  it('restores bottom-follow mode when user scrolls back down mid-stream', () => {
    expect(resolveViewportRestoreTarget({
      wasAtBottom: false,
      savedViewportY: 40,
      pendingUserScrollIntent: {
        viewportY: null,
        stickToBottom: true
      }
    })).toBe('bottom')
  })

  it('falls back to the saved viewport when there is no new user intent', () => {
    expect(resolveViewportRestoreTarget({
      wasAtBottom: false,
      savedViewportY: 40,
      pendingUserScrollIntent: null
    })).toBe(40)
  })

  it('does not force a restore when the terminal was already following output', () => {
    expect(resolveViewportRestoreTarget({
      wasAtBottom: true,
      savedViewportY: 40,
      pendingUserScrollIntent: null
    })).toBeNull()
  })
})
