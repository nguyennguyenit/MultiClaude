# Phase 2: Hidden->Visible Focus Trigger

## Context Links
- [Plan Overview](./plan.md)
- [xterm.js Focus Research](./research/researcher-01-xterm-focus.md)
- [Phase 1: Atomic State](./phase-01-atomic-state-update.md)

## Overview
**Priority:** P1 (High)
**Status:** pending
**Effort:** 1h

Track previous hidden state and trigger focus when transitioning from hidden to visible. Current implementation only triggers focus on `isActive` change, missing the hidden->visible transition.

## Key Insights
- `isActive` effect only fires when prop changes `false->true`
- Terminal stays mounted (single-parent pattern), so `isActive` may not change
- `hidden` prop can change independently: project switch changes hidden, isActive unchanged
- Need: Track previous hidden state, focus on `wasHidden && !isHidden && isActive`
- Also send ANSI cursor show escape code `\x1b[?25h` for robustness

## Requirements
### Functional
- Focus terminal when transitioning hidden->visible
- Force cursor visible with ANSI escape code
- Refit terminal after visibility change (dimensions may have changed)

### Non-Functional
- No additional timeouts beyond existing WebGL debounce
- No double-focus calls

## Architecture

```typescript
// use-terminal.ts - Add visibility transition effect
const prevHiddenRef = useRef(isHidden)

useEffect(() => {
  const wasHidden = prevHiddenRef.current
  prevHiddenRef.current = isHidden

  if (wasHidden && !isHidden && isActive && terminalRef.current) {
    // Wait for WebGL toggle to complete
    setTimeout(() => {
      if (disposedRef.current || !terminalRef.current) return
      // Force cursor visible
      terminalRef.current.write('\x1b[?25h')
      terminalRef.current.focus()
      fitAddonRef.current?.fit()
    }, WEBGL_TOGGLE_DEBOUNCE + 10)
  }
}, [isHidden, isActive])
```

## Related Code Files
**Modify:**
- `src/renderer/hooks/use-terminal.ts` - Add visibility transition effect

## Implementation Steps

1. **Add prevHiddenRef**
   - After line 66: `const prevHiddenRef = useRef(isHidden)`

2. **Add visibility transition effect**
   - After the WebGL toggle effect (around line 562)
   - Track previous hidden state
   - On hidden->visible transition: wait for WebGL, then focus + fit + cursor show

3. **Consider debounce consolidation**
   - Existing WebGL debounce = 50ms
   - New focus delay = 60ms (50 + 10)
   - Ensures focus after WebGL loaded

## Todo List
- [ ] Add `prevHiddenRef` ref
- [ ] Add visibility transition useEffect
- [ ] Include ANSI cursor show escape code
- [ ] Test: Switch A->B, verify cursor in B
- [ ] Test: Switch B->A, verify cursor in A (the key case)
- [ ] Test: Rapid switching doesn't cause focus spam

## Success Criteria
- Cursor appears when switching back to previously active project
- Focus correctly set after WebGL addon loaded
- No visible delay or flicker

## Risk Assessment
| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| Double focus calls | Medium | Low | Guard with disposed check |
| Timeout conflicts | Low | Low | Use consistent timing with WebGL debounce |
| Focus interrupt during typing | Low | Medium | Only focus on visibility change, not continuous |

## Security Considerations
- None - ANSI escape codes are standard terminal control sequences

## Next Steps
- Phase 3: Ensure focus happens after WebGL addon fully loaded
