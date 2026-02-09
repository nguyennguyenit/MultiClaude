# Code Review: Fix Terminal Display Corruption

**Date:** 2026-01-06
**Reviewer:** code-reviewer
**Scope:** Terminal race condition bugfix
**Score:** 8/10

## Summary

Files reviewed: 3
Lines analyzed: ~400
Focus: Race condition fix for terminal display corruption during project switching

## Overall Assessment

Solid fix addressing root cause. Implements proper WebGL disposal order + transition delay to prevent mount/unmount race. Follows KISS principle. Minor improvements possible.

## Critical Issues

*None*

## High Priority Findings

*None*

## Medium Priority Warnings

| Issue | File | Line | Description |
|-------|------|------|-------------|
| Magic numbers | `use-terminal.ts` | 66, 92, 247 | Timeouts (50ms, 100ms) should be named constants |
| Magic number | `App.tsx` | 94 | 150ms delay should reference cleanup timeout |
| No rapid-switch guard | `App.tsx` | 89-98 | Spam-clicking projects could queue multiple transitions |

### Detail: Magic Numbers

```typescript
// Current (use-terminal.ts:92)
setTimeout(() => { ... }, 50)

// Suggested
const TERMINAL_INIT_DELAY_MS = 50
const TERMINAL_CLEANUP_DELAY_MS = 100

// In App.tsx:94
const PROJECT_SWITCH_DELAY_MS = TERMINAL_CLEANUP_DELAY_MS + 50
```

### Detail: Rapid Switch Protection

If user switches A->B->C quickly, could have overlapping transitions:
```typescript
// Potential fix (not required for MVP)
if (projectSwitching) return // debounce
```

## Low Priority Suggestions

1. **Opacity too subtle**: `opacity-50` may not clearly indicate transition; consider `opacity-30` or add spinner
2. **Comment the timing relationship**: Add comment explaining 150ms > 100ms dependency
3. **Consider AbortController**: For cancelling pending transitions on rapid switch

## Positive Observations

1. **Proper disposal order**: WebGL -> FitAddon -> Terminal prevents GPU leaks
2. **DisposedRef guard**: Prevents ops on disposed terminals (lines 33, 68, 225-226)
3. **Ref capture before nullify**: Lines 229-234 capture refs before cleanup - prevents null reference
4. **Clean interface**: `isTransitioning` prop is minimal, memo-wrapped component
5. **Buffer margin**: 150ms > 100ms ensures cleanup completes before remount
6. **Initial load optimization**: prevProjectIdRef prevents delay on first project selection

## Architecture Notes

Race condition fix strategy:
```
Old Flow (buggy):
  Project Switch -> setActiveProject -> new terminals mount
                                      -> old terminals dispose (async)
                                      -> RACE: new sees old's WebGL context

New Flow (fixed):
  Project Switch -> setProjectSwitching(true)
                 -> setActiveProject
                 -> wait 150ms (exceeds 100ms cleanup)
                 -> setProjectSwitching(false)
                 -> new terminals mount safely
```

## Test Coverage

- 58/58 tests passed
- Build: Success
- TypeScript: No errors

## Recommended Actions

1. **Optional**: Extract timeout constants to shared config
2. **Optional**: Add JSDoc comment explaining timing relationship
3. **Monitor**: Watch for user reports of transition feeling slow

## Verdict

**Approve** - Fix correctly addresses root cause with minimal complexity. Magic numbers are acceptable for internal timing constants. No blockers.

---

## Unresolved Questions

*None*
