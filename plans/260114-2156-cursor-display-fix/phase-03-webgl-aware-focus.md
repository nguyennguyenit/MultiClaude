# Phase 3: WebGL-Aware Focus

## Context Links
- [Plan Overview](./plan.md)
- [xterm.js Focus Research](./research/researcher-01-xterm-focus.md)
- [Phase 2: Visibility Focus](./phase-02-visibility-focus-trigger.md)

## Overview
**Priority:** P2 (Medium)
**Status:** pending
**Effort:** 1h

Ensure focus is called after WebGL addon fully loaded, not during loading. Current WebGL toggle uses `requestAnimationFrame` which may complete after the visibility focus effect.

## Key Insights
- WebGL toggle: `requestAnimationFrame` inside 50ms debounce
- Focus from Phase 2: setTimeout of 60ms
- Race condition: Focus could fire while WebGL still loading
- Solution: Focus after WebGL load completes, not on fixed timeout
- Track `webglLoadingRef` state and focus in rAF callback

## Requirements
### Functional
- Focus after WebGL addon.loadAddon() completes
- Fallback focus if WebGL not needed
- Handle rapid switching gracefully

### Non-Functional
- Remove arbitrary timeout dependency
- Maintain single focus call per switch

## Architecture

```typescript
// use-terminal.ts - Modify WebGL toggle effect
const toggleWebGL = () => {
  // ... existing guards ...

  if (needsWebGL && !hasWebGL) {
    webglLoadingRef.current = true
    requestAnimationFrame(() => {
      // ... existing WebGL load ...
      webglLoadingRef.current = false

      // Focus after WebGL loaded (if active and visible)
      if (isActiveRef.current && !isHiddenRef.current && terminalRef.current) {
        terminalRef.current.write('\x1b[?25h')
        terminalRef.current.focus()
        fitAddonRef.current?.fit()
      }
    })
  }
}
```

## Related Code Files
**Modify:**
- `src/renderer/hooks/use-terminal.ts` - Add focus call inside WebGL load rAF

## Implementation Steps

1. **Add focus after WebGL load**
   - In the WebGL toggle effect, after `loadAddon(webglAddon)` succeeds
   - Check `isActiveRef.current && !isHiddenRef.current`
   - Call focus + fit + cursor show

2. **Guard against double focus**
   - Phase 2 focus happens on visibility change
   - Phase 3 focus happens after WebGL load
   - Both should be safe - focus is idempotent
   - Consider: Remove Phase 2 timeout, rely on Phase 3 for WebGL mode

3. **Handle non-WebGL mode**
   - If `needsWebGL = false`, Phase 2 timeout still needed
   - Or: Add immediate focus for non-WebGL case in toggle effect

## Todo List
- [ ] Add focus after WebGL loadAddon in rAF callback (line ~535)
- [ ] Include cursor show escape code
- [ ] Test: Quality mode (always WebGL) - cursor appears
- [ ] Test: Balanced mode (active only) - cursor appears
- [ ] Test: Performance mode (no WebGL) - cursor appears
- [ ] Test: Rapid switching doesn't cause issues

## Success Criteria
- Cursor appears reliably in all render modes
- No arbitrary timeouts for WebGL case
- Performance mode still works (Phase 2 handles it)

## Risk Assessment
| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| Double focus calls | Medium | Low | Focus is idempotent, no harm |
| Missing focus in edge case | Low | Medium | Keep Phase 2 as fallback |
| WebGL load failure | Low | Low | Existing try/catch handles it |

## Security Considerations
- None - terminal focus is standard UI behavior

## Next Steps
- Phase 4: Add E2E tests to prevent regression
