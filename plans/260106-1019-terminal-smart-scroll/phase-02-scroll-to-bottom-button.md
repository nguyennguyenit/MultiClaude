# Phase 2: Add Scroll-to-Bottom Button

## Context Links

- [Parent Plan](./plan.md)
- [Phase 1: Smart Scroll](./phase-01-implement-smart-scroll.md)

## Overview

| Field | Value |
|-------|-------|
| Priority | P2 |
| Status | Complete |
| Effort | 30m |
| Description | Add floating scroll-to-bottom button that appears when user scrolls up |

## Key Insights

1. Button should only appear when user is NOT at bottom (isAtBottom = false)
2. Position: bottom-right corner of terminal, floating above content
3. Click action: call `scrollToBottom()` and hide button
4. Need to expose `isAtBottom` state and `scrollToBottom` function from hook

## Requirements

### Functional
- Floating button appears when scrolled up
- Button disappears when at bottom
- Click scrolls to bottom immediately
- Smooth visual appearance (fade in/out)

### Non-Functional
- No layout shift
- Minimal z-index impact
- Match existing button styles

## Architecture

```
use-terminal.ts                    terminal-view.tsx
     │                                   │
     ├─ isAtBottom state ────────────────► Show/hide button
     └─ scrollToBottom() ─────────────────► onClick handler
```

## Related Code Files

| File | Action | Description |
|------|--------|-------------|
| `src/renderer/hooks/use-terminal.ts` | Modify | Expose isAtBottom and scrollToBottom |
| `src/renderer/components/terminal/terminal-view.tsx` | Modify | Add floating button UI |

## Implementation Steps

### Step 1: Expose isAtBottom state from use-terminal.ts

Add to return object:

```typescript
return {
  containerRef,
  initTerminal,
  write,
  fit,
  focus,
  clear,
  scrollToBottom,  // NEW
  isAtBottom: isAtBottomRef.current,  // NEW - Note: need to use state for reactivity
  terminal: terminalRef.current
}
```

**Important**: For UI reactivity, need `useState` instead of ref:

```typescript
const [isAtBottom, setIsAtBottom] = useState(true)

terminal.onScroll(() => {
  const buffer = terminal.buffer.active
  const atBottom = buffer.viewportY >= buffer.baseY
  setIsAtBottom(atBottom)
  isAtBottomRef.current = atBottom // Keep ref for write()
})

// Add scrollToBottom callback
const scrollToBottom = useCallback(() => {
  terminalRef.current?.scrollToBottom()
}, [])
```

### Step 2: Add floating button in terminal-view.tsx

```tsx
export const TerminalView = memo(function TerminalView({ ... }: TerminalViewProps) {
  const { containerRef, initTerminal, write, fit, focus, isAtBottom, scrollToBottom } = useTerminal({
    terminalId,
    initialOutput,
    isActive
  })

  // ... existing code ...

  return (
    <div
      className="terminal-container-wrapper"
      style={{ height: '100%', width: '100%', position: 'relative' }}
    >
      <div
        ref={containerRef}
        className="terminal-container"
        style={{ height: '100%', width: '100%' }}
      />

      {/* Floating scroll-to-bottom button */}
      {!isAtBottom && (
        <button
          type="button"
          onClick={scrollToBottom}
          className="absolute bottom-3 right-3 p-2 rounded-full bg-[var(--mc-bg-tertiary)] hover:bg-[var(--mc-bg-hover)] border border-[var(--mc-border)] text-[var(--mc-text-muted)] hover:text-[var(--mc-text-primary)] shadow-lg transition-opacity duration-200"
          title="Scroll to bottom"
          aria-label="Scroll to bottom"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
          </svg>
        </button>
      )}
    </div>
  )
})
```

## Todo List

- [x] Add `isAtBottom` state (useState) to use-terminal.ts
- [x] Keep `isAtBottomRef` for write() function (non-reactive)
- [x] Add `scrollToBottom` callback to use-terminal.ts
- [x] Update hook return object
- [x] Add floating button JSX to terminal-view.tsx
- [x] Style button with existing theme variables
- [x] Verify button appears/disappears correctly

## Success Criteria

1. Button appears when user scrolls up
2. Button disappears when at bottom
3. Click scrolls to bottom immediately
4. Button matches existing UI style
5. No layout shift or flickering

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| State update causes re-render | Low | Low | Use state for button visibility only |
| Button overlaps important content | Low | Low | Position in corner with padding |

## Security Considerations

None - UI component only.

## Next Steps

After implementation:
1. Proceed to Phase 3 for testing
2. Test button visibility behavior
3. Verify click functionality
