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
 *   2. Always: call IPC resize directly (bypasses lastSent dedup at
 *      use-terminal-init.ts:439) so a fresh SIGWINCH reaches the PTY even
 *      when (cols, rows) didn't change at renderer level.
 *
 * Caller (use-terminal-webgl.ts subscriber) is responsible for:
 *   - feature flag gate (VITE_MULTICLAUDE_RESIZE_REPAINT)
 *   - snapshot-replay mutex check (avoid racing system-resume replay)
 *   - disposal guard
 */

import type { Terminal as XTerm } from '@xterm/xterm'

export function triggerAltBufferRepaint(terminalId: string, term: XTerm): void {
  // Clear stale alt-buffer grid so app's next render is a full repaint
  if (term.buffer.active.type === 'alternate') {
    term.write('\x1b[2J\x1b[H')
  }

  // Force SIGWINCH by calling IPC directly (bypasses renderer debounce/dedup)
  try {
    window.electron.terminal.resize(terminalId, term.cols, term.rows)
  } catch {
    // ignore — non-fatal (main may have torn down during pane close)
  }
}

/** Feature flag — default ON. Set VITE_MULTICLAUDE_RESIZE_REPAINT=0 to disable. */
export function isResizeRepaintEnabled(): boolean {
  return import.meta.env.VITE_MULTICLAUDE_RESIZE_REPAINT !== '0'
}
