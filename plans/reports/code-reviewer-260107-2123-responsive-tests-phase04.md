# Code Review: Phase 04 Responsive Layout Tests

**File:** `src/__tests__/e2e/tests/responsive.spec.ts`
**Branch:** beta
**Reviewer:** code-reviewer
**Date:** 2026-01-07

---

## Score: 8.5/10

Solid test implementation with minor improvements possible.

---

## Critical Issues

None.

---

## Warnings

1. **Duplicate viewport definitions** (lines 14-20)
   - `viewports` array duplicates `viewportSizes` imported from fixtures
   - Imports `viewportSizes` but defines local array anyway
   - **Impact:** Maintenance burden if viewport configs need updating

2. **Fragile CSS selector** (line 91)
   ```ts
   const terminalArea = window.locator('.flex-1.min-h-0').first()
   ```
   - Class-based selector will break if styling changes
   - Should use `data-testid` like other elements

3. **Fragile titlebar button selector** (lines 256-257)
   ```ts
   const titleBar = window.locator('.titlebar-drag')
   const toggleButton = titleBar.locator('button').first()
   ```
   - `.first()` assumes button order; fragile if UI changes

---

## Suggestions

1. **Extract magic numbers to constants**
   ```ts
   const SIDEBAR_MIN_WIDTH = 40
   const SIDEBAR_MAX_WIDTH = 280
   const TRANSITION_WAIT = 300
   ```
   - Lines 81-82, 183, 207, 215, etc use hardcoded values

2. **Use shared viewport config**
   - Convert `viewportSizes` object to array format in test-data.ts, or
   - Use `Object.values(viewportSizes)` with name property added

3. **Consider test parallelization**
   - Parameterized viewport tests run sequentially within describe block
   - Could use `test.describe.parallel()` for faster execution

---

## Positive Observations

- Clean test organization with JSDoc comments
- Consistent use of `data-testid` selectors for most elements
- Good helper functions (`getElementDimensions`, `hasHorizontalScrollbar`)
- Proper wait times for layout settling
- Fixes correctly remove auto-collapse assumption
- Toggle tests properly verify width changes
- Visual regression screenshots well-organized

---

## Changes Verified

| Fix | Status |
|-----|--------|
| Removed unused `SIDEBAR_COLLAPSE_THRESHOLD` | Confirmed (not present) |
| Fixed "sidebar is visible and functional" | Confirmed (lines 79-82 check 40-280px range) |
| Fixed "sidebar collapse toggle works at small viewport" | Confirmed (lines 222-248 test toggle properly) |

---

## YAGNI/KISS/DRY Assessment

| Principle | Status | Notes |
|-----------|--------|-------|
| YAGNI | Pass | No over-engineering |
| KISS | Pass | Logic is straightforward |
| DRY | Minor | Viewport definitions duplicated |

---

## Recommended Actions

1. [ ] Add `data-testid="terminal-area"` to terminal grid container
2. [ ] Add `data-testid="titlebar-toggle"` to titlebar button
3. [ ] Consider extracting timeout/dimension constants
4. [ ] Low priority: unify viewport configurations

---

## Unresolved Questions

None.
