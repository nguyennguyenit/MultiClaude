import { describe, expect, it } from 'vitest'
import {
  createUserScrollIntent,
  isPointerOnViewportScrollbar,
  isViewportNearBottom,
  resolveFitViewportRestoreTarget,
  resolveViewportRestoreTarget,
  TERMINAL_SCROLL_OPTIONS,
  withInstantTerminalScroll,
  TERMINAL_SCROLL_THRESHOLD
} from './terminal-scroll-utils'

describe('terminal-scroll-utils', () => {
  it('enables a short smooth animation for user-driven wheel scrolling', () => {
    expect(TERMINAL_SCROLL_OPTIONS).toEqual({ smoothScrollDuration: 125 })
  })

  it('keeps programmatic viewport reconciliation instantaneous', () => {
    const terminal = { options: { smoothScrollDuration: 125 } }
    let durationDuringScroll: number | undefined

    withInstantTerminalScroll(terminal, () => {
      durationDuringScroll = terminal.options.smoothScrollDuration
    })

    expect(durationDuringScroll).toBe(0)
    expect(terminal.options.smoothScrollDuration).toBe(125)
  })

  it('restores wheel smoothing when a programmatic scroll throws', () => {
    const terminal = { options: { smoothScrollDuration: 125 } }

    expect(() => withInstantTerminalScroll(terminal, () => {
      throw new Error('scroll failed')
    })).toThrow('scroll failed')
    expect(terminal.options.smoothScrollDuration).toBe(125)
  })

  it('treats viewports within the threshold as bottom-following', () => {
    expect(isViewportNearBottom(120, 116, TERMINAL_SCROLL_THRESHOLD)).toBe(true)
  })

  it('treats viewports outside the threshold as scrollback', () => {
    expect(isViewportNearBottom(120, 114, TERMINAL_SCROLL_THRESHOLD)).toBe(false)
  })

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
      currentBaseY: 80,
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
      currentBaseY: 80,
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
      currentBaseY: 40,
      pendingUserScrollIntent: null
    })).toBe(40)
  })

  it('preserves the same absolute viewport line while new output is appended below it', () => {
    expect(resolveViewportRestoreTarget({
      wasAtBottom: false,
      savedViewportY: 75,
      currentBaseY: 160,
      pendingUserScrollIntent: null
    })).toBe(75)
  })

  it('forces bottom-follow mode after local input requests live output', () => {
    expect(resolveViewportRestoreTarget({
      forceStickToBottom: true,
      wasAtBottom: false,
      savedViewportY: 40,
      currentBaseY: 40,
      pendingUserScrollIntent: {
        viewportY: 12,
        stickToBottom: false
      }
    })).toBe('bottom')
  })

  it('does not force a restore when the terminal was already following output', () => {
    expect(resolveViewportRestoreTarget({
      wasAtBottom: true,
      savedViewportY: 40,
      currentBaseY: 40,
      pendingUserScrollIntent: null
    })).toBeNull()
  })

  it('only treats pointer presses on the viewport scrollbar as drag intent', () => {
    expect(isPointerOnViewportScrollbar({
      clientX: 396,
      viewportClientWidth: 388,
      viewportOffsetWidth: 400,
      viewportRight: 400
    })).toBe(true)

    expect(isPointerOnViewportScrollbar({
      clientX: 320,
      viewportClientWidth: 388,
      viewportOffsetWidth: 400,
      viewportRight: 400
    })).toBe(false)
  })

  it('does not infer scrollbar dragging when overlay scrollbars have no gutter', () => {
    expect(isPointerOnViewportScrollbar({
      clientX: 400,
      viewportClientWidth: 400,
      viewportOffsetWidth: 400,
      viewportRight: 400
    })).toBe(false)
  })

  it('recognizes xterm custom vertical scrollbar pointer events without a native gutter', () => {
    const customScrollbar = {
      classList: {
        contains: (className: string) => className === 'scrollbar' || className === 'vertical'
      }
    } as unknown as EventTarget

    expect(isPointerOnViewportScrollbar({
      clientX: 400,
      viewportClientWidth: 400,
      viewportOffsetWidth: 400,
      viewportRight: 400,
      eventPath: [customScrollbar]
    })).toBe(true)
  })

  it('keeps bottom-following panes pinned to live output after fit changes the viewport size', () => {
    expect(resolveFitViewportRestoreTarget({
      restoreViewport: true,
      wasAtBottom: true,
      savedViewportY: 0,
      currentBaseY: 14
    })).toBe('bottom')
  })

  it('restores the saved viewport line after fit when the user was reading scrollback', () => {
    expect(resolveFitViewportRestoreTarget({
      restoreViewport: true,
      wasAtBottom: false,
      savedViewportY: 42,
      currentBaseY: 100
    })).toBe(42)
  })

  it('skips viewport restoration when fit is explicitly told not to preserve it', () => {
    expect(resolveFitViewportRestoreTarget({
      restoreViewport: false,
      wasAtBottom: true,
      savedViewportY: 0,
      currentBaseY: 14
    })).toBeNull()
  })
})
