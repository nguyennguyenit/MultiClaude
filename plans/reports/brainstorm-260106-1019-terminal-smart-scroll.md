# Brainstorm: Terminal Smart Scroll

**Date**: 2026-01-06
**Branch**: `feature/terminal-rendering-mode`
**Status**: Agreed

---

## Problem Statement

When Claude finishes generating long output and displays Yes/No prompt, terminal scrolls UP instead of staying at bottom, making it difficult to interact with the prompt.

**Expected behavior**: Smart scroll - auto-scroll to bottom if already at bottom, but preserve position if user has scrolled up to read previous output.

---

## Root Cause Analysis

1. xterm.js default behavior should keep viewport at bottom when at bottom
2. Potential interference from `fit()` and `focus()` calls in `terminal-view.tsx` (lines 51-56) when terminal becomes active
3. No explicit scroll management in current implementation

---

## Evaluated Approaches

| Option | Description | Pros | Cons |
|--------|-------------|------|------|
| A: Always scroll | Call `scrollToBottom()` after every write | Simple, direct | Interrupts user reading scrollback |
| **B: Smart scroll** ✅ | Track scroll position, only scroll if at bottom | Best UX, matches requirement | Slightly more complex |
| C: Event-based | Use `onWriteParsed` for async-safe scroll | Avoids race conditions | Still needs position tracking |

---

## Final Solution: Smart Scroll (Option B)

### Implementation Plan

**File**: `src/renderer/hooks/use-terminal.ts`

1. Add ref to track if viewport is at bottom
2. Listen to xterm's `onScroll` event to update position state
3. Modify `write()` to conditionally call `scrollToBottom()`

### Code Changes

```typescript
// Add ref
const isAtBottomRef = useRef(true)

// In initTerminal(), after terminal.open():
terminal.onScroll(() => {
  const buffer = terminal.buffer.active
  // At bottom when viewport reaches base (where cursor is)
  isAtBottomRef.current = buffer.viewportY >= buffer.baseY
})

// Modify write function
const write = useCallback((data: string) => {
  terminalRef.current?.write(data)
  // Smart scroll: only if user was at bottom
  if (isAtBottomRef.current) {
    terminalRef.current?.scrollToBottom()
  }
}, [])
```

---

## Success Metrics

1. ✅ Terminal stays at bottom during normal output streaming
2. ✅ User can scroll up to read without being forced back
3. ✅ Yes/No prompt visible after Claude completes output
4. ✅ No performance regression

---

## Implementation Considerations

- **xterm.js API**: `buffer.viewportY` and `buffer.baseY` used to detect bottom position
- **Event cleanup**: `onScroll` returns disposable, should be cleaned up on unmount
- **Edge case**: Initial state should be `true` (at bottom)

---

## Next Steps

1. Implement smart scroll in `use-terminal.ts`
2. Test with long code generation
3. Verify scroll-up-and-read behavior preserved
