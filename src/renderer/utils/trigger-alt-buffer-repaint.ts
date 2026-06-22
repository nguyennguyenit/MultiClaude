/**
 * triggerAltBufferRepaint — force alt-screen TUI to fully redraw after a resize.
 *
 * Problem: when user finishes a drag/split/window-resize, SIGWINCH may have
 * already fired via the natural xterm.onResize → debounce → IPC chain. But
 * alt-screen apps (Claude TUI, vim, tmux) often repaint only their cursor
 * area on SIGWINCH and leave stale grid content. This helper:
 *
 *   1. If alt-buffer active → write `\x1b[2J\x1b[H` (clear screen + home).
 *      The app's next paint becomes a full repaint at the new dimensions.
 *   2. If alt-buffer active → call IPC resize directly so a fresh SIGWINCH
 *      reaches the PTY even when (cols, rows) didn't change at renderer level.
 *      Normal-buffer panes skip this because the regular onResize path already
 *      keeps PTY dimensions synced to the visible grid.
 *
 * Caller (use-terminal-webgl.ts subscriber) is responsible for:
 *   - feature flag gate (VITE_MULTICLAUDE_RESIZE_REPAINT)
 *   - snapshot-replay mutex check (avoid racing system-resume replay)
 *   - disposal guard
 */

import type { Terminal as XTerm } from '@xterm/xterm'
import { logResize } from './terminal-resize-debug'
import { sendPtyResize } from './pty-resize-coordinator'

export function triggerAltBufferRepaint(
  terminalId: string,
  term: XTerm
): void {
  const bufferType = term.buffer.active.type
  if (bufferType === 'alternate') {
    // Alt-screen TUIs (vim, htop, less) clear-and-redraw on SIGWINCH. We
    // pre-clear the grid so the next full-frame paint isn't layered on top of
    // a stale frame at the old dimensions.
    term.write('\x1b[2J\x1b[H')
    logResize('ipc', terminalId, { phase: 'send-sigwinch-bypass', cols: term.cols, rows: term.rows })
    sendPtyResize({ terminalId, xtermCols: term.cols, rows: term.rows, isAlt: true })
    return
  }

  // Normal buffer: the debounced onResize path has already sent the visible
  // dimensions. Avoid a duplicate SIGWINCH at resize-end; fish and inline TUIs
  // can redraw prompts noisily when they receive redundant resize events.
  void terminalId
}

/** Feature flag — default ON. Set VITE_MULTICLAUDE_RESIZE_REPAINT=0 to disable. */
export function isResizeRepaintEnabled(): boolean {
  return import.meta.env.VITE_MULTICLAUDE_RESIZE_REPAINT !== '0'
}
