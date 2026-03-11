# Code Review: Scroll-to-Bottom Button Implementation

**Date:** 2026-01-06
**Branch:** beta
**Reviewer:** code-reviewer
**Score:** 8/10

---

## Scope

- **Files reviewed:** 2
  - `src/renderer/hooks/use-terminal.ts`
  - `src/renderer/components/terminal/terminal-view.tsx`
- **Lines changed:** ~25
- **Tests:** 58/58 passed
- **Typecheck:** Pass
- **Lint:** No new errors (21 pre-existing warnings)

---

## Overall Assessment

Clean, minimal implementation following YAGNI/KISS/DRY. Good performance pattern using ref for hot path (`write()`) and state for UI reactivity. Proper accessibility attributes present.

---

## Critical Issues (MUST FIX)

None.

---

## Warnings (SHOULD FIX)

### 1. Button Animation Missing (Medium)

**File:** `terminal-view.tsx:80`

Button uses `transition-opacity` but conditionally renders via `{!isAtBottom && ...}`. This means mount/unmount, not opacity transition - no actual animation occurs.

**Impact:** Abrupt visual appearance/disappearance, slightly jarring UX.

**Fix options:**
- Keep button always mounted, toggle visibility via opacity + pointer-events
- Use CSS animation on mount with `animate-fade-in` class

```tsx
// Option A: Always mounted, visibility toggle
<button
  className={`... transition-opacity duration-200 ${isAtBottom ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}
  ...
/>
```

---

## Suggestions (NICE TO HAVE)

### 1. Consider Scroll Position Threshold

Current: Button shows immediately when user scrolls even 1 line up.

Alternative: Show button only when scrolled significantly (e.g., 5+ lines from bottom) to reduce flicker during minor scroll adjustments.

```ts
const atBottom = buffer.baseY - buffer.viewportY < 5  // threshold
```

### 2. Style Consistency

Parent wrapper uses inline styles while button uses Tailwind. Could unify:
```tsx
<div className="h-full w-full relative">
```

### 3. Extract SVG to Component (Optional)

If more icons needed later, consider shared icon component. For single use, inline is fine.

---

## Positive Observations

1. **Performance pattern** - Dual ref+state approach avoids re-renders on `write()` hot path
2. **Accessibility** - Proper `aria-label`, `title`, `type="button"` attributes
3. **Theming** - Uses CSS variables (`--mc-*`) for consistent dark/light mode
4. **Cleanup** - Scroll listener properly disposed via `scrollDisposableRef`
5. **Minimal scope** - Only added what's necessary, no over-engineering

---

## Recommended Actions

1. **Optional:** Add fade animation for smoother UX (Warning #1)
2. **Optional:** Consider scroll threshold to reduce button flicker

---

## Metrics

| Metric | Value |
|--------|-------|
| Type Coverage | Pass |
| Test Coverage | 58/58 |
| New Lint Issues | 0 |
| Security Issues | 0 |
| Performance Issues | 0 |

---

## Verdict

**APPROVED** - Ship ready. Animation enhancement optional but recommended for polish.
