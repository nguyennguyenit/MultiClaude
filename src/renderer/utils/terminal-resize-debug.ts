/**
 * terminal-resize-debug — gated console logging for resize flow diagnosis.
 *
 * Enable via DevTools console:
 *   localStorage.terminalResizeDebug = '1'
 *   // (reload not required — read on every log call)
 *
 * Disable:
 *   delete localStorage.terminalResizeDebug
 *
 * Or set at runtime:
 *   window.__TERMINAL_RESIZE_DEBUG__ = true
 *
 * Log categories (filter in DevTools console):
 *   [RESIZE observer]   container size change from ResizeObserver
 *   [RESIZE fit]        performFit lifecycle (propose, skip, done, cols-changed)
 *   [RESIZE ipc]        IPC SIGWINCH sent to main/PTY
 *   [RESIZE replay]     reflow-safe snapshot replay fire
 *   [RESIZE end]        trailing-edge resize-end events
 *
 * Each log includes terminalId + cols/rows/width/height to correlate paths.
 */

type DebugWindow = typeof window & {
  __TERMINAL_RESIZE_DEBUG__?: boolean
}

export function isResizeDebugEnabled(): boolean {
  if (typeof window === 'undefined') return false
  const w = window as DebugWindow
  if (w.__TERMINAL_RESIZE_DEBUG__ === true) return true
  try {
    return window.localStorage?.getItem('terminalResizeDebug') === '1'
  } catch {
    return false
  }
}

export function logResize(category: string, terminalId: string, data: Record<string, unknown>): void {
  if (!isResizeDebugEnabled()) return
  const ts = new Date().toISOString().slice(11, 23) // HH:MM:SS.mmm
  console.log(`[RESIZE ${category}] ${ts} ${terminalId}`, data)
}
