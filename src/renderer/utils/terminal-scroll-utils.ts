export const TERMINAL_SCROLL_THRESHOLD = 5

export interface UserScrollIntent {
  viewportY: number | null
  stickToBottom: boolean
}

export type ViewportRestoreTarget = number | 'bottom' | null

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
  wasAtBottom,
  savedViewportY,
  pendingUserScrollIntent
}: {
  wasAtBottom: boolean
  savedViewportY: number
  pendingUserScrollIntent: UserScrollIntent | null
}): ViewportRestoreTarget {
  if (pendingUserScrollIntent) {
    return pendingUserScrollIntent.stickToBottom ? 'bottom' : pendingUserScrollIntent.viewportY
  }

  if (!wasAtBottom && savedViewportY >= 0) {
    return savedViewportY
  }

  return null
}
