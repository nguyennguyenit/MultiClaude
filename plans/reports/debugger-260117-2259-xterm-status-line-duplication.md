# Terminal Status Line Duplication Bug - Root Cause Analysis

**Report Date:** 2026-01-17
**Bug:** Claude Code CLI status line duplicates instead of updating in-place
**Severity:** Medium - affects user experience but not functionality
**Environment:** MultiClaude xterm.js terminal (Linux)

---

## Executive Summary

Claude Code CLI status lines duplicate and stack vertically instead of updating in-place. Root cause identified: **missing xterm.js terminal options** that control escape sequence handling, combined with **auto-scroll interference** during cursor positioning operations.

**Quick Fix:** Add 3 missing terminal options + adjust scroll behavior.

---

## Evidence

### Symptoms
- Status line: `* Đề xuất giải pháp fix... (ctrl+c to interrupt · 4m 3s · ↓ 3.5k tokens)` duplicates multiple times
- Each duplicate shows incrementing token count (3.5k → 3.6k → 3.7k...)
- Indicates sequential updates that should replace each other via `\r` (carriage return)
- Works correctly in regular terminal, only fails in MultiClaude

### How CLI Status Lines Work
Claude Code uses ANSI escape sequences to update status in-place:
```
\r                 # Move cursor to beginning of line
\x1b[2K            # Clear entire line
Status text here   # Write new status
# NO \n at end - stays on same line
```

Next update repeats this sequence on the **same line**.

---

## Root Cause Analysis

### 1. Missing xterm.js Terminal Options

**File:** `src/renderer/hooks/use-terminal.ts:120-128`

```typescript
const terminal = new XTerm({
  cursorBlink: true,
  cursorStyle: 'block',
  cursorInactiveStyle: 'block',
  fontSize: 14,
  fontFamily: TERMINAL_FONT_FAMILY,
  theme: getCurrentTerminalTheme(),
  allowProposedApi: true
  // ❌ MISSING: windowsMode, convertEol, scrollback
})
```

**Missing options that affect escape sequences:**
- `windowsMode: false` - Without this, xterm.js may auto-convert `\r` to `\r\n` on some platforms
- `convertEol: false` - Prevents automatic EOL conversion that breaks cursor positioning
- `scrollback: 10000` - Low default (1000) may cause scrollback issues

### 2. Auto-Scroll Interference

**File:** `src/renderer/hooks/use-terminal.ts:364-369`

```typescript
const write = useCallback((data: string) => {
  terminalRef.current?.write(data)
  // ⚠️ PROBLEM: Scrolls to bottom on EVERY write when at bottom
  if (isAtBottomRef.current) {
    terminalRef.current?.scrollToBottom()
  }
}, [])
```

When Claude Code sends status update escape sequences:
1. `\r` moves cursor to line start
2. `\x1b[2K` clears line
3. Status text is written
4. **`scrollToBottom()` is called**

The `scrollToBottom()` call may interfere with cursor positioning, causing xterm.js to treat the update as a new line instead of an in-place update.

### 3. PTY Configuration (Verified Correct)

**File:** `src/main/terminal/terminal-manager.ts:133-139`

```typescript
const ptyProcess = pty.spawn(command, args, {
  name: 'xterm-256color',
  cwd,
  env: { ...process.env, TERM: 'xterm-256color' },
  cols: 80,
  rows: 24
})
```

✅ TERM is correctly set to `xterm-256color`
✅ Supports alternate screen buffer and cursor positioning
✅ No issues found in PTY layer

### 4. IPC Data Path (Verified Correct)

**File:** `src/main/ipc/handlers.ts:41-43`

```typescript
terminalManager.on('output', ({ terminalId, data }) => {
  if (!window.isDestroyed()) {
    window.webContents.send(IPC_CHANNELS.TERMINAL_OUTPUT, { terminalId, data })
  }
})
```

✅ Data passed directly without modification
✅ No buffering that could break escape sequences
✅ No issues found in IPC layer

---

## Solution

### Fix 1: Add Missing Terminal Options

**File:** `src/renderer/hooks/use-terminal.ts`

**Location:** Line 120, in `initTerminal()` function

**Change:**
```typescript
const terminal = new XTerm({
  cursorBlink: true,
  cursorStyle: 'block',
  cursorInactiveStyle: 'block',
  fontSize: 14,
  fontFamily: TERMINAL_FONT_FAMILY,
  theme: getCurrentTerminalTheme(),
  allowProposedApi: true,
  // Add these 3 options:
  windowsMode: false,      // Don't auto-convert \r to \r\n
  convertEol: false,       // Don't auto-convert line endings
  scrollback: 10000        // Increase scrollback buffer
})
```

### Fix 2: Conditional Auto-Scroll

**File:** `src/renderer/hooks/use-terminal.ts`

**Location:** Line 364, `write()` function

**Change:**
```typescript
const write = useCallback((data: string) => {
  terminalRef.current?.write(data)
  // Only scroll to bottom if data contains newline
  // This prevents scroll interference with cursor positioning escape sequences
  if (isAtBottomRef.current && data.includes('\n')) {
    terminalRef.current?.scrollToBottom()
  }
}, [])
```

**Rationale:** Status line updates use `\r` without `\n`, so they won't trigger scroll. Normal output with `\n` will still auto-scroll.

---

## Testing Plan

1. **Verify status line updates in-place:**
   - Run Claude Code CLI in MultiClaude terminal
   - Watch status line during long operation
   - Confirm no duplication, token count increments in-place

2. **Verify normal scrolling still works:**
   - Run commands that produce lots of output (`ls -R /usr`)
   - Confirm terminal auto-scrolls to bottom
   - Confirm scroll-to-bottom button appears when scrolled up

3. **Test edge cases:**
   - Multiple terminals with Claude Code running simultaneously
   - Rapid status updates (fast token increments)
   - Status updates while terminal is hidden/inactive

---

## Risk Assessment

**Low Risk:**
- Changes are minimal (3 option flags + 1 conditional check)
- All options are standard xterm.js configuration
- Scroll behavior change only affects data without `\n`
- Fallback: Changes can be reverted without side effects

**Potential Side Effects:**
- None expected - these are standard terminal options
- Scroll behavior is more precise (only scrolls when needed)

---

## References

**Code Files:**
- `/home/plateau/Desktop/Claude Code/MultiClaude/src/renderer/hooks/use-terminal.ts`
- `/home/plateau/Desktop/Claude Code/MultiClaude/src/main/terminal/terminal-manager.ts`
- `/home/plateau/Desktop/Claude Code/MultiClaude/src/renderer/components/terminal/terminal-view.tsx`

**xterm.js Documentation:**
- Terminal options: https://xtermjs.org/docs/api/terminal/interfaces/iterminaloptions/
- `windowsMode`: Controls carriage return behavior
- `convertEol`: Controls automatic line ending conversion
- `scrollback`: Number of lines in scrollback buffer

**ANSI Escape Sequences:**
- `\r` - Carriage return (move to start of line)
- `\x1b[2K` - Clear entire line
- `\x1b[?25h` - Show cursor
- `\x1b[?25l` - Hide cursor

---

## Unresolved Questions

None. Root cause identified with high confidence.
