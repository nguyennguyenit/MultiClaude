/**
 * pty-resize-coordinator — single chokepoint for SIGWINCH-to-PTY traffic.
 *
 * Keep resize traffic to the PTY predictable.
 *
 * Normal-buffer shells and inline agent UIs redraw inconsistently on SIGWINCH:
 * fish can duplicate the prompt, and Claude appends freshly redrawn frames
 * while old frames remain in scrollback. Keep PTY size stable in the normal
 * buffer; only sync the headless mirror so snapshot refreshes match the visual
 * pane. Full-screen alt-buffer apps still receive exact PTY dimensions.
 */

export interface SendPtyResizeArgs {
  terminalId: string
  /** xterm.cols at the time of the resize event. */
  xtermCols: number
  /** Current rows — always forwarded as-is. */
  rows: number
  /** Whether the terminal is currently in alt-screen mode. */
  isAlt: boolean
  /** Whether this terminal is currently running Claude Code. Kept for logging callers. */
  isClaudeMode?: boolean
}

export interface SendPtyResizeResult {
  /** The cols actually sent to the PTY. */
  sentCols: number
  /** True if PTY cols diverged from xterm cols. Kept for logging compatibility. */
  decoupled: boolean
  /** True when SIGWINCH is intentionally suppressed. Kept for caller logging. */
  skipped: boolean
}

export function sendPtyResize(args: SendPtyResizeArgs): SendPtyResizeResult {
  const { terminalId, xtermCols, rows, isAlt } = args
  const sentCols = xtermCols

  if (!isAlt) {
    try {
      window.electron.terminal.resizeHeadless?.(terminalId, sentCols, rows)
    } catch {
      // Non-fatal: older preload/main during hot reload, or teardown race.
    }
    return { sentCols, decoupled: false, skipped: true }
  }

  try {
    window.electron.terminal.resize(terminalId, sentCols, rows)
  } catch {
    // Non-fatal: main may have torn down during pane close.
  }

  return { sentCols, decoupled: false, skipped: false }
}

/** Clear high-water resize state on terminal teardown. */
export function clearPtyMaxCols(terminalId: string): void {
  void terminalId
}

/** Test helper — exposed only for unit tests. */
export function _getPtyMaxColsForTests(terminalId: string): number | undefined {
  void terminalId
  return undefined
}

/** Test helper — reset internal state. */
export function _resetForTests(): void {
  // No retained state.
}
