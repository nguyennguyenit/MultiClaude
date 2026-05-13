/**
 * Terminal resize-end event dispatcher — renderer-internal pub/sub.
 *
 * Mirrors terminal-lifecycle-dispatcher.ts pattern but for "user finished a
 * resize gesture" events (drag-end, split-end, window-resize trailing edge).
 *
 * Each terminal subscribes once; publish sites fire by terminalId. Used by
 * use-terminal-webgl.ts to trigger alt-buffer repaint after layout settles.
 *
 * No IPC involved — pure in-process pub/sub.
 */

type ResizeEndCallback = () => void

const handlers = new Map<string, ResizeEndCallback>()

export function subscribeToResizeEnd(terminalId: string, callback: ResizeEndCallback): void {
  handlers.set(terminalId, callback)
}

export function unsubscribeFromResizeEnd(terminalId: string): void {
  handlers.delete(terminalId)
}

export function publishResizeEnd(terminalId: string): void {
  const handler = handlers.get(terminalId)
  if (!handler) return
  try {
    handler()
  } catch (err) {
    console.error('[resize-end-dispatcher] handler threw:', err)
  }
}

/** Test helper — clears subscriptions. Never call from production code. */
export function resetResizeEndDispatcherForTests(): void {
  handlers.clear()
}
