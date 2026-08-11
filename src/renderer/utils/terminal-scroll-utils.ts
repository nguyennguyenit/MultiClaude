export const TERMINAL_SCROLL_THRESHOLD = 5

export const TERMINAL_SCROLL_OPTIONS = {
  smoothScrollDuration: 125,
} as const

interface SmoothScrollTerminal {
  options: {
    smoothScrollDuration?: number
  }
}

/** Keep state-restoration commands synchronous while wheel input stays smooth. */
export function withInstantTerminalScroll<T>(
  terminal: SmoothScrollTerminal,
  operation: () => T
): T {
  const smoothScrollDuration = terminal.options.smoothScrollDuration ?? 0
  terminal.options.smoothScrollDuration = 0
  try {
    return operation()
  } finally {
    terminal.options.smoothScrollDuration = smoothScrollDuration
  }
}

export interface UserScrollIntent {
  viewportY: number | null
  stickToBottom: boolean
}

export type ViewportRestoreTarget = number | 'bottom' | null

function clampViewportY(viewportY: number, baseY: number): number {
  return Math.max(0, Math.min(viewportY, baseY))
}

export function isPointerOnViewportScrollbar({
  clientX,
  viewportClientWidth,
  viewportOffsetWidth,
  viewportRight,
  eventPath = []
}: {
  clientX: number
  viewportClientWidth: number
  viewportOffsetWidth: number
  viewportRight: number
  eventPath?: readonly EventTarget[]
}): boolean {
  const isCustomVerticalScrollbar = eventPath.some((target) => {
    const classList = (target as EventTarget & {
      classList?: Pick<DOMTokenList, 'contains'>
    }).classList
    return classList?.contains('scrollbar') === true && classList.contains('vertical')
  })
  if (isCustomVerticalScrollbar) return true

  const scrollbarWidth = viewportOffsetWidth - viewportClientWidth
  if (scrollbarWidth <= 0) return false

  return clientX >= viewportRight - scrollbarWidth
}

export function isViewportNearBottom(
  baseY: number,
  viewportY: number,
  scrollThreshold = TERMINAL_SCROLL_THRESHOLD
): boolean {
  return baseY - viewportY <= scrollThreshold
}

export function createUserScrollIntent(
  baseY: number,
  viewportY: number,
  scrollThreshold = TERMINAL_SCROLL_THRESHOLD
): UserScrollIntent {
  return isViewportNearBottom(baseY, viewportY, scrollThreshold)
    ? { viewportY: null, stickToBottom: true }
    : { viewportY, stickToBottom: false }
}

export function resolveViewportRestoreTarget({
  forceStickToBottom = false,
  wasAtBottom,
  savedViewportY,
  currentBaseY,
  pendingUserScrollIntent
}: {
  forceStickToBottom?: boolean
  wasAtBottom: boolean
  savedViewportY: number
  currentBaseY: number
  pendingUserScrollIntent: UserScrollIntent | null
}): ViewportRestoreTarget {
  if (forceStickToBottom) {
    return 'bottom'
  }

  if (pendingUserScrollIntent) {
    if (pendingUserScrollIntent.stickToBottom) {
      return 'bottom'
    }

    if (pendingUserScrollIntent.viewportY === null) {
      return null
    }

    return clampViewportY(pendingUserScrollIntent.viewportY, currentBaseY)
  }

  if (!wasAtBottom && savedViewportY >= 0) {
    return clampViewportY(savedViewportY, currentBaseY)
  }

  return null
}

export function resolveFitViewportRestoreTarget({
  restoreViewport,
  wasAtBottom,
  savedViewportY,
  currentBaseY
}: {
  restoreViewport: boolean
  wasAtBottom: boolean
  savedViewportY: number
  currentBaseY: number
}): ViewportRestoreTarget {
  if (!restoreViewport) {
    return null
  }

  if (wasAtBottom) {
    return 'bottom'
  }

  if (savedViewportY >= 0) {
    return clampViewportY(savedViewportY, currentBaseY)
  }

  return null
}
