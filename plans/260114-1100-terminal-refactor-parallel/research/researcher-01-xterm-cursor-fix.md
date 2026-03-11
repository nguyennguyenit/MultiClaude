# Research: xterm.js Cursor Jump on Resize

**Date**: 2026-01-14
**Researcher**: a507208
**Context**: MultiClaude terminal viewport preservation during project switching

## Root Causes

### 1. FitAddon Resets Viewport Position
- `fit()` recalculates terminal dimensions (cols/rows) and **resets viewport to default position**
- Default behavior: viewport jumps to bottom or loses relative position
- Occurs when container size changes OR when fit() called programmatically

### 2. Buffer/Viewport Coordinate Shift
- **Buffer** = all terminal data (scrollback + visible)
- **Viewport** = visible window (viewportY to viewportY+rows)
- During resize: buffer dimensions change → viewport coordinates become invalid
- `baseY` (cursor line) and `viewportY` (scroll position) relationship breaks

### 3. Timing Race: fit() → scrollToLine()
- Current code (L378-389): calls `scrollToLine()` immediately after `fit()`
- **Problem**: `fit()` triggers internal async rendering (RAF-based)
- `scrollToLine()` executes before internal viewport recalculation completes
- Result: scroll position set correctly but then overridden by fit's delayed rendering

### 4. Ratio-Based Restoration Flaw
```typescript
// L371-373: Current approach
const savedRatio = savedState.viewportY / savedState.baseY
const newViewportY = Math.round(savedRatio * buffer.baseY)
```
- **Issue**: Ratio assumes linear relationship between old/new buffer
- Breaks when terminal output changes between save/restore (new lines added)
- Doesn't account for fit() resetting viewport internally

## GitHub Issues Evidence

### Issue #5145: Cursor Position Report Desync (2024)
- CPR behavior unreliable during rapid viewport updates
- `xterm-addon-fit` triggers cause cursor tracking desync

### Issue #3564: FitAddon Viewport Width Miscalculation
- Shrinking container → incorrect viewport width calculation
- Cursor "jumps" to next line or disappears

### Issue #3179: Resize Vertical Position Failure
- Dynamic line-height/text height changes → cursor vertical position incorrect
- Cumulative drift on repeated resizes

### Issue #934, #1120: Auto-Scroll Failure
- Fixed CSS viewport height (vs engine-calculated) → improper cursor position
- Viewport jumps to top/bottom unexpectedly on resize

## Recommended Solutions

### Solution A: Defer scrollToLine() to Next Frame (BEST)
```typescript
const fit = useCallback(() => {
  if (!terminalRef.current || !fitAddonRef.current) return
  try {
    const terminal = terminalRef.current
    const buffer = terminal.buffer.active
    const savedState = savedViewportRef.current
    const savedRatio = savedState?.baseY > 0
      ? savedState.viewportY / savedState.baseY
      : null

    fitAddonRef.current.fit()

    // CRITICAL: Defer restore to next frame after fit's internal rendering
    if (savedState && savedRatio !== null && buffer.baseY > 0) {
      requestAnimationFrame(() => {
        if (!terminalRef.current) return
        const buf = terminalRef.current.buffer.active
        const newViewportY = Math.round(savedRatio * buf.baseY)
        const clamped = Math.max(0, Math.min(newViewportY, buf.baseY))
        terminalRef.current.scrollToLine(clamped)
        isAtBottomRef.current = savedState.isAtBottom
        savedViewportRef.current = null
      })
    }
  } catch { /* ignore */ }
}, [])
```

**Why**:
- `fit()` uses internal RAF for viewport updates
- Double-RAF ensures scrollToLine() runs AFTER fit's rendering completes
- Prevents position override race condition

### Solution B: Absolute Position Instead of Ratio
```typescript
// Save absolute viewportY offset from bottom
const offsetFromBottom = buffer.baseY - buffer.viewportY

// Restore
const newViewportY = buffer.baseY - offsetFromBottom
terminal.scrollToLine(Math.max(0, newViewportY))
```

**Why**:
- More predictable when new lines added between save/restore
- Preserves "distance from bottom" which is what users perceive

### Solution C: Conditional Restore (Skip if at Bottom)
```typescript
if (savedState && !savedState.isAtBottom) {
  // Only restore if user wasn't at bottom
  requestAnimationFrame(() => { /* restore logic */ })
} else {
  // User was at bottom - let fit() default behavior (scrollToBottom) work
}
```

**Why**:
- Most users expect "stay at bottom" behavior
- Only restore when user intentionally scrolled up
- Reduces unnecessary viewport manipulation

### Solution D: Double RAF for Maximum Safety
```typescript
fitAddonRef.current.fit()

requestAnimationFrame(() => {
  requestAnimationFrame(() => {
    // Restore viewport here (2 frames after fit)
  })
})
```

**Why**:
- Some implementations report single RAF insufficient
- Double RAF ensures all CSS/layout recalculations complete

## Recommended Implementation

**Combine Solution A + B** for maximum stability:

```typescript
const fit = useCallback(() => {
  if (!terminalRef.current || !fitAddonRef.current) return
  try {
    const terminal = terminalRef.current
    const buffer = terminal.buffer.active
    const savedState = savedViewportRef.current

    // Calculate offset from bottom (more stable than ratio)
    const savedOffset = savedState?.baseY
      ? savedState.baseY - savedState.viewportY
      : null

    fitAddonRef.current.fit()

    // Defer to next frame after fit's internal rendering
    if (savedState && savedOffset !== null) {
      requestAnimationFrame(() => {
        if (!terminalRef.current) return
        const buf = terminalRef.current.buffer.active

        // Restore position from bottom
        const newViewportY = buf.baseY - savedOffset
        const clamped = Math.max(0, Math.min(newViewportY, buf.baseY))

        terminalRef.current.scrollToLine(clamped)
        isAtBottomRef.current = savedState.isAtBottom
        savedViewportRef.current = null
      })
    }
  } catch { /* ignore */ }
}, [])
```

## Additional Best Practices

1. **Line-height sync**: Verify CSS `line-height` matches xterm.js config (L119)
2. **Debounce fit()**: Already implemented via window resize handler (L518)
3. **Avoid CSS viewport overrides**: Not an issue in current code
4. **Hidden container guard**: Already implemented (L108-114)

## References

- [xterm.js Discussion #5145: CPR Behavior](https://github.com/xtermjs/xterm.js/discussions/5145)
- [xterm.js Issue #3564: FitAddon Shrinking](https://github.com/xtermjs/xterm.js/issues/3564)
- [xterm.js Issue #3179: Resize Vertical Position](https://github.com/xtermjs/xterm.js/issues/3179)
- [Stack Overflow: xterm.js scroll bar problems](https://stackoverflow.com/questions/66012345/xterm-js-initial-height-and-scroll-bar-problems)
- [xterm.js Documentation](https://xtermjs.org/)
- [FitAddon Repository](https://github.com/xtermjs/xterm.js/tree/master/addons/addon-fit)

## Unresolved Questions

1. Does MultiClaude's terminal output change between project switches? (affects ratio vs offset choice)
2. Is there a performance impact of double RAF in rapid project switching scenarios?
3. Should we add ResizeObserver instead of window resize listener for container-specific resize detection?
