# Terminal Activation Repaint Fix

## Summary

Fixed intermittent terminal WebGL render corruption after switching panes/sessions or returning to MultiClaude from another app.

## Symptoms

- Terminal text/canvas became garbled after clicking a different session.
- Input line sometimes rendered missing spaces or misplaced characters after app focus.
- Manual Refresh fixed the pane until the next activation cycle.

## Root Cause

Active-pane focus path only called `focus()` / `showCursor()`. It did not clear the xterm texture atlas or repaint the visible rows, while manual Refresh did a full WebGL reset + snapshot replay.

## Change

- Added `restoreActiveRender()` to `useTerminal`.
- On terminal activation, clear texture atlas and fit/repaint immediately, then repeat after cursor restore delay.
- On app window focus, repaint the active terminal.
- Added `TerminalView` regression tests for activation and window-focus repaint.

## Verification

- `npm test -- src/renderer/components/terminal/terminal-view.spec.tsx`
- `npm test -- src/renderer/hooks/__tests__/use-terminal-snapshot-refresh.spec.ts`
- `npm test -- src/renderer/hooks/__tests__/use-terminal-clipboard.spec.ts`
- `npm run typecheck`
- `npm run lint` passes with 4 pre-existing warnings outside changed files.

## Unresolved Questions

None.
