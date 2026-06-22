/**
 * Terminal resize-end event dispatcher — renderer-internal pub/sub.
 *
 * Mirrors terminal-lifecycle-dispatcher.ts pattern but for "user finished a
 * resize gesture" events (drag-end, split-end, window-resize trailing edge).
 *
 * Each terminal subscribes once; publish sites fire by terminalId. Used by
 * use-terminal-webgl.ts to trigger alt-buffer repaint after layout settles,
 * and to run heavier snapshot repair for resize sources that can corrupt
 * normal-buffer scrollback.
 *
 * No IPC involved — pure in-process pub/sub.
 */

export type ResizeEndSource = 'pane-drag' | 'window' | 'split' | 'external'

type ResizeEndCallback = (source: ResizeEndSource) => void

const handlers = new Map<string, ResizeEndCallback>()
const autoRefreshSuppressedUntil = new Map<string, number>()
const SPLIT_AUTO_REFRESH_SUPPRESSION_MS = 1200

export function subscribeToResizeEnd(terminalId: string, callback: ResizeEndCallback): void {
  handlers.set(terminalId, callback)
}

export function unsubscribeFromResizeEnd(terminalId: string): void {
  handlers.delete(terminalId)
}

export function publishResizeEnd(terminalId: string, source: ResizeEndSource = 'external'): void {
  const handler = handlers.get(terminalId)
  if (!handler) return
  try {
    handler(source)
  } catch (err) {
    console.error('[resize-end-dispatcher] handler threw:', err)
  }
}

export function suppressAutoResizeRefresh(
  terminalId: string,
  durationMs = SPLIT_AUTO_REFRESH_SUPPRESSION_MS,
): void {
  autoRefreshSuppressedUntil.set(terminalId, Date.now() + durationMs)
}

export function suppressAutoResizeRefreshForTerminals(
  terminalIds: string[],
  durationMs = SPLIT_AUTO_REFRESH_SUPPRESSION_MS,
): void {
  for (const terminalId of terminalIds) {
    suppressAutoResizeRefresh(terminalId, durationMs)
  }
}

export function isAutoResizeRefreshSuppressed(terminalId: string): boolean {
  const suppressedUntil = autoRefreshSuppressedUntil.get(terminalId)
  if (suppressedUntil === undefined) return false
  if (Date.now() <= suppressedUntil) return true
  autoRefreshSuppressedUntil.delete(terminalId)
  return false
}

/** Test helper — clears subscriptions. Never call from production code. */
export function resetResizeEndDispatcherForTests(): void {
  handlers.clear()
  autoRefreshSuppressedUntil.clear()
}
