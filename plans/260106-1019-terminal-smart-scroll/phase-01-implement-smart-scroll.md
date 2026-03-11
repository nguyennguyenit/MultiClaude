# Phase 1: Implement Smart Scroll

## Context Links

- [Parent Plan](./plan.md)
- [Brainstorm Report](../reports/brainstorm-260106-1019-terminal-smart-scroll.md)

## Overview

| Field | Value |
|-------|-------|
| Priority | P2 |
| Status | Complete |
| Effort | 30m |
| Description | Add smart scroll tracking to use-terminal.ts hook |

## Key Insights

1. xterm.js provides `buffer.viewportY` (current scroll position) and `buffer.baseY` (bottom position)
2. `terminal.onScroll()` fires on every scroll event, returns disposable for cleanup
3. When `viewportY >= baseY`, viewport is at bottom
4. Initial state should be `true` (at bottom) for new terminals

## Requirements

### Functional
- Track if viewport is at bottom using `onScroll` event
- Call `scrollToBottom()` after write only if was at bottom
- Preserve user's scroll position when reading scrollback

### Non-Functional
- No performance regression
- Proper event cleanup on unmount

## Architecture

```
User scrolls up → isAtBottomRef = false → new output arrives → NO scroll
User at bottom → isAtBottomRef = true → new output arrives → scrollToBottom()
```

## Related Code Files

| File | Action | Description |
|------|--------|-------------|
| `src/renderer/hooks/use-terminal.ts` | Modify | Add scroll tracking logic |

## Implementation Steps

### Step 1: Add scroll tracking ref (line ~53)

```typescript
const isAtBottomRef = useRef(true) // Track if viewport is at bottom
```

Add after `isActiveRef` declaration.

### Step 2: Add onScroll listener in initTerminal (after line 82)

```typescript
// Track scroll position for smart scroll behavior
terminal.onScroll(() => {
  const buffer = terminal.buffer.active
  // At bottom when viewport reaches base (where cursor is)
  isAtBottomRef.current = buffer.viewportY >= buffer.baseY
})
```

Add after `terminal.open(container)`.

### Step 3: Modify write function (lines 217-220)

```typescript
// Write data to terminal with smart scroll
const write = useCallback((data: string) => {
  terminalRef.current?.write(data)
  // Smart scroll: only scroll to bottom if user was at bottom
  if (isAtBottomRef.current) {
    terminalRef.current?.scrollToBottom()
  }
}, [])
```

## Todo List

- [x] Add `isAtBottomRef` ref
- [x] Add `onScroll` listener in `initTerminal`
- [x] Modify `write` function with conditional scroll
- [x] Verify no TypeScript errors
- [x] Build succeeds

## Success Criteria

1. Terminal auto-scrolls during normal output streaming when at bottom
2. User can scroll up without being forced back
3. Yes/No prompt visible after Claude completes output
4. No console errors or TypeScript issues

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Performance impact from scroll listener | Low | Low | xterm handles this efficiently |
| Race condition in scroll detection | Low | Medium | Use ref, not state |

## Security Considerations

None - this is purely UI behavior change.

## Next Steps

After implementation:
1. Proceed to Phase 2 for testing
2. Test with long code generation scenarios
3. Verify scroll-up-and-read behavior preserved
