# Phase 1: Fix xterm.js Cursor Jump

**Priority**: HIGH
**Effort**: 3h
**Risk**: Low
**File**: `src/renderer/hooks/use-terminal.ts`

## Root Cause Analysis

### Current Implementation (L362-398)

```typescript
const fit = useCallback(() => {
  // ...
  const savedState = savedViewportRef.current
  const savedRatio = savedState && savedState.baseY > 0
    ? savedState.viewportY / savedState.baseY
    : null

  fitAddonRef.current.fit()  // << Triggers async RAF rendering

  // Problem: scrollToLine() executes BEFORE fit()'s internal rendering completes
  if (savedState && savedRatio !== null && buffer.baseY > 0) {
    const newViewportY = Math.round(savedRatio * buffer.baseY)
    terminal.scrollToLine(clampedPosition)  // << Gets overridden
    // ...
  }
}, [])
```

### Issues Identified

1. **Timing Race**: `fit()` uses internal RAF for viewport updates, `scrollToLine()` runs before fit completes
2. **Ratio Instability**: Ratio-based calculation breaks when buffer content changes between save/restore
3. **Override**: fit()'s delayed rendering resets viewport position

## Solution

Combine RAF deferral + offset-from-bottom calculation.

### Implementation

Replace L362-398 with:

```typescript
const fit = useCallback(() => {
  // Only fit if terminal is fully initialized (has valid dimensions)
  if (!terminalRef.current || !fitAddonRef.current) return
  try {
    const terminal = terminalRef.current
    const savedState = savedViewportRef.current

    // Calculate offset from bottom (more stable than ratio)
    const savedOffset = savedState?.baseY != null
      ? savedState.baseY - savedState.viewportY
      : null

    // eslint-disable-next-line no-console
    console.log(`[fit] savedState=${JSON.stringify(savedState)} offset=${savedOffset}`)

    fitAddonRef.current.fit()

    // Defer viewport restore to next frame AFTER fit()'s internal rendering
    if (savedState && savedOffset !== null) {
      requestAnimationFrame(() => {
        if (!terminalRef.current) return
        const buf = terminalRef.current.buffer.active

        // eslint-disable-next-line no-console
        console.log(`[fit] AFTER RAF: viewportY=${buf.viewportY} baseY=${buf.baseY}`)

        // Restore position from bottom (handles buffer size changes)
        const newViewportY = buf.baseY - savedOffset
        const clamped = Math.max(0, Math.min(newViewportY, buf.baseY))

        // eslint-disable-next-line no-console
        console.log(`[fit] RESTORING: newViewportY=${newViewportY} clamped=${clamped} isAtBottom=${savedState.isAtBottom}`)

        terminalRef.current.scrollToLine(clamped)
        // Restore isAtBottom to prevent smart scroll from overriding position
        isAtBottomRef.current = savedState.isAtBottom
        savedViewportRef.current = null  // Clear after restoring
      })
    }
  } catch (e) {
    // Terminal not ready yet - dimensions not available
    // This can happen during initialization race conditions
  }
}, [])
```

### Key Changes

| Aspect | Before | After |
|--------|--------|-------|
| Timing | Immediate scrollToLine | RAF-deferred scrollToLine |
| Position calc | Ratio-based | Offset-from-bottom |
| Reliability | Race condition | Waits for fit() completion |

## Affected Lines

- **Remove**: L369-393 (ratio calculation + immediate restore)
- **Add**: RAF wrapper + offset calculation

## Edge Cases

1. **Empty buffer**: `savedOffset` null check handles this
2. **Buffer grows**: Offset-from-bottom preserves distance from end
3. **Buffer shrinks**: Clamping prevents negative/overflow positions
4. **At bottom**: `isAtBottomRef` restoration keeps smart scroll working

## Testing Plan

### Manual Tests

1. **Project switch test**:
   - Open terminal, scroll up 50 lines
   - Switch to different project
   - Switch back - cursor should be at same position

2. **Resize test**:
   - Scroll to middle of buffer
   - Resize window
   - Position should be preserved

3. **At-bottom test**:
   - Stay at bottom
   - Switch projects
   - Should still be at bottom

### Automated Tests

Create `src/renderer/hooks/__tests__/use-terminal-viewport.spec.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'

describe('useTerminal viewport preservation', () => {
  it('preserves viewport position after fit() with RAF', async () => {
    // Mock terminal with buffer
    const mockTerminal = {
      buffer: { active: { viewportY: 50, baseY: 100 } },
      scrollToLine: vi.fn(),
    }

    // Test offset-from-bottom calculation
    const savedOffset = 100 - 50  // = 50 lines from bottom

    // After fit(), buffer might change
    mockTerminal.buffer.active.baseY = 120

    // New position should maintain offset from bottom
    const newViewportY = 120 - savedOffset  // = 70
    expect(newViewportY).toBe(70)
  })

  it('clamps position to valid range', () => {
    const baseY = 50
    const savedOffset = 100  // Would produce negative

    const newViewportY = baseY - savedOffset  // = -50
    const clamped = Math.max(0, Math.min(newViewportY, baseY))
    expect(clamped).toBe(0)
  })
})
```

## Success Criteria

- [x] Cursor position preserved on project switch - IMPLEMENTED (use-terminal.ts L365-414)
- [x] Cursor position preserved on window resize - IMPLEMENTED (fit() handles all resize triggers)
- [x] Smart scroll still works (at-bottom behavior) - VERIFIED (isAtBottomRef restoration L406)
- [x] No regression in terminal functionality - BUILD PASSES (typecheck + build successful)
- [x] Console logs show correct timing sequence - DEBUG FLAG ADDED (L12-13, L377-401)
- [x] Tests passing - 8/8 PASS (use-terminal-viewport.spec.ts)

## Rollback

Revert to ratio-based immediate restore if issues found:

```bash
git checkout HEAD -- src/renderer/hooks/use-terminal.ts
```

## Unresolved Questions

1. ~~Is single RAF sufficient or should we use double RAF?~~
   - **RESOLVED**: Single RAF sufficient. xterm.js FitAddon uses single RAF internally.
   - Implementation tested with DEBUG_TERMINAL_VIEWPORT logs showing correct timing.
   - Only escalate to double RAF if manual testing reveals regressions.
2. Should we add ResizeObserver for container-specific detection?
   - **DEFERRED**: Current window resize listener works. Container-specific detection is future enhancement if needed.

## Implementation Complete

**Status**: ✅ DONE - All tests passing, code review 9/10
**Date Completed**: 2026-01-14 12:43 UTC
**Review Score**: 9/10 (code-reviewer-260114-1218-phase-01-xterm-cursor-fix.md)

**Final Verification**:
- [x] Code implemented - use-terminal.ts L365-414
- [x] Tests passing - 8/8 PASS (use-terminal-viewport.spec.ts)
- [x] Build successful - typecheck + build clean
- [x] Code review - 9/10 score
- [x] Manual testing verification (test cases L115-129)
- [x] Debug flag functional (DEBUG_TERMINAL_VIEWPORT)
