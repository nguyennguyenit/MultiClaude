# Code Review: Terminal Smart Scroll Feature

**Date:** 2026-01-06
**Reviewer:** code-reviewer-af8b62a
**Score:** 8.5/10

## Scope

- `src/renderer/hooks/use-terminal.ts` (428 lines)
- `src/renderer/components/terminal/terminal-view.tsx` (92 lines)

## Overall Assessment

Solid implementation of smart scroll feature. Good separation between performance-critical ref tracking and reactive UI state. Proper use of xterm disposables for cleanup. Minor issues with event listener cleanup pattern.

## Critical Issues (Must Fix)

None.

## Warnings (Should Fix)

### 1. Event Listeners Not Explicitly Cleaned Up
**File:** `use-terminal.ts:137-158`

```typescript
terminal.element?.addEventListener('mouseup', async () => { ... })
terminal.element?.addEventListener('contextmenu', async (e) => { ... })
```

These listeners are added but not explicitly removed. While `terminal.dispose()` destroys the element (implicit GC), explicit cleanup is safer.

**Fix:** Store references and call `removeEventListener` in cleanup effect, or use `{ once: true }` if applicable.

### 2. Potential Race Condition in skipAppendRef Timer
**File:** `terminal-view.tsx:29-35`

500ms magic number without comment explaining timing rationale. If terminal init takes longer, duplicate output could still occur.

**Suggestion:** Add comment or tie to terminal ready event if available.

## Suggestions (Nice to Have)

### 1. Extract Scroll Threshold as Constant
**File:** `use-terminal.ts:92`

```typescript
const SCROLL_THRESHOLD = 5
```

Currently defined inside `initTerminal`. Move to top with other constants for consistency.

### 2. Consider useMemo for Button ClassName
**File:** `terminal-view.tsx:79-81`

String concatenation on every render. Low impact, but could use `clsx` or memoize if perf critical.

### 3. Add JSDoc to scrollToBottom Export
**File:** `use-terminal.ts:266-268`

Other functions have implicit purpose; this one serves UI button - brief doc would help.

## Positive Observations

- Dual tracking pattern (ref for write perf, state for UI) - clever design
- 5-line threshold reduces button flicker as specified
- Proper `IDisposable` usage for xterm listeners (line 93-99)
- `aria-label` and `aria-hidden` for accessibility
- CSS `pointer-events-none` prevents ghost clicks
- Transition animation for smooth UX
- `memo()` wrapper on TerminalView prevents parent re-renders
- Clean TypeScript - no type errors

## Metrics

| Metric | Value |
|--------|-------|
| Type Coverage | 100% (no `any`) |
| TypeScript Errors | 0 |
| Memory Leak Risk | Low |
| Re-render Risk | Low (threshold mitigates) |

## Verdict

Feature requirements met:
- [x] Auto-scroll when at bottom
- [x] Preserve position when scrolled up
- [x] Floating button visibility
- [x] 5-line threshold anti-flicker

Ready for merge with optional cleanup improvements.
