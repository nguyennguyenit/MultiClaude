# Investigation Report: Terminal First Line Loss on Project Switch

**ID:** af9ab6f
**Date:** 2026-01-01
**Status:** Root Cause Identified
**Severity:** Medium

---

## Executive Summary

**Issue:** When switching between projects, the first terminal line (prompt) disappears.
**Root Cause:** Missing output restoration logic when terminal views remount after project switching.
**Impact:** UX degradation - users lose terminal context when navigating between projects.

---

## Technical Analysis

### Data Flow Overview

```
PTY Process (node-pty)
    |
    v
TerminalManager.outputBuffer  <-- Stores output (main process)
    |
    v (IPC: terminal:output)
    |
app-store.terminals[].output  <-- Stores output (renderer)
    |
    v (Never restored!)
    |
XTerm Instance               <-- Created fresh on mount, stays empty
```

### Problem Sequence

1. **Project A active:** Terminal shows `plateau@plateau-MS-7D42:~/...$`
2. **Switch to Project B:**
   - `TerminalGrid` filters terminals by `projectId`
   - Project A's `TerminalPane` unmounts
   - XTerm instance disposed via `useTerminal` cleanup
   - Output preserved in `app-store.terminals[].output`
3. **Switch back to Project A:**
   - New `TerminalPane` mounts
   - `initTerminal()` creates FRESH empty xterm
   - `onOutput` listener set up for NEW output only
   - **BUG:** Stored output never written to xterm
   - Terminal appears empty until new activity

### Evidence from Source Code

| File | Line | Issue |
|------|------|-------|
| `app-store.ts` | 43 | `addTerminal` initializes `output: ''` |
| `app-store.ts` | 68-78 | `appendOutput` stores output but never read |
| `terminal-grid.tsx` | 7 | `TerminalWithOutput` has `output` field - never used |
| `use-terminal.ts` | 29-95 | `initTerminal()` creates empty xterm, no restore |
| `ipc-channels.ts` | - | No `TERMINAL_GET_BUFFER` channel exists |

### Two Separate Output Buffers

1. **Main Process:** `TerminalManager.outputBuffer` (100KB max, sliced to 50KB)
2. **Renderer:** `app-store.terminals[].output` (100KB max via `appendOutput`)

Both store output but neither is used for restoration.

### Race Condition Assessment

Secondary concern - potential race between:
- `initTerminal()` effect completing
- `onOutput` listener effect setup

However, this is **unlikely to be the primary cause** because:
- For project switching, the PTY is already running (no new prompt sent)
- IPC latency gives xterm time to initialize
- Both effects run synchronously on mount

**Primary cause is the missing restoration logic, not race conditions.**

---

## Root Cause

**Missing feature:** Terminal output restoration on component remount.

When `TerminalView` unmounts (project switch) and remounts (switch back), the stored output buffer is never written to the new xterm instance.

---

## Recommendations

### Immediate Fix (Priority 1)

Modify `use-terminal.ts` to restore buffered output on init:

```typescript
// In useTerminal hook, accept initialOutput prop
interface UseTerminalOptions {
  terminalId: string
  initialOutput?: string  // Add this
  onResize?: (cols: number, rows: number) => void
}

// In initTerminal(), after xterm.open():
if (initialOutput) {
  terminal.write(initialOutput)
}
```

Then pass `terminal.output` from `TerminalGrid` through `TerminalPane` to `TerminalView`.

### Alternative Fix (IPC-based)

Add IPC channel to fetch buffer from main process:

```typescript
// ipc-channels.ts
TERMINAL_GET_BUFFER: 'terminal:get-buffer'

// handlers.ts
ipcMain.handle(IPC_CHANNELS.TERMINAL_GET_BUFFER, (_, id: string) => {
  return terminalManager.getBuffer(id)
})

// use-terminal.ts - fetch on init
const buffer = await window.electron.terminal.getBuffer(terminalId)
terminal.write(buffer)
```

### Architecture Improvement (Priority 2)

Consider keeping xterm instances alive but hidden:
- Use CSS `visibility: hidden` instead of unmounting
- Avoids buffer restoration complexity
- Trade-off: Memory usage for multiple terminals

---

## Files Affected

- `/home/plateau/Desktop/Claude Code/MultiClaude/src/renderer/hooks/use-terminal.ts`
- `/home/plateau/Desktop/Claude Code/MultiClaude/src/renderer/components/terminal/terminal-view.tsx`
- `/home/plateau/Desktop/Claude Code/MultiClaude/src/renderer/components/terminal/terminal-pane.tsx`
- `/home/plateau/Desktop/Claude Code/MultiClaude/src/renderer/components/terminal/terminal-grid.tsx`

---

## Unresolved Questions

1. Should output be restored from renderer store (`app-store`) or main process (`TerminalManager.outputBuffer`)?
   - Renderer store is simpler (already available)
   - Main process buffer is more authoritative
2. Should there be a maximum buffer size for restoration to avoid performance issues?
3. Is there a need to preserve cursor position and terminal state (not just output)?
