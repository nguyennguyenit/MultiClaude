# Phase 6 E2E Test Results - Interactive & Keyboard Tests

**Date:** 2026-01-07 23:03
**Duration:** 45.3s
**Test Files:** keyboard-shortcuts.spec.ts, form-inputs.spec.ts, state-transitions.spec.ts

## Summary

| Status | Count |
|--------|-------|
| Passed | 20 |
| Failed | 1 |
| Skipped | 5 |
| **Total** | **26** |

**Pass Rate:** 77% (20/26)

---

## Failed Tests (1)

### `Alt+1 switches to first project`
- **File:** `keyboard-shortcuts.spec.ts:16`
- **Error:** Strict mode violation - locator resolved to 2 elements
- **Root Cause:** Selector `[class*="bg-[var(--mc-bg-primary)]"]:has-text("Project1")` matches both:
  1. Main app container div (has same bg class)
  2. Actual project tab element
- **Fix:** Use more specific selector like `getByTestId('project-tab-test-project-1')` or add `.first()` constraint

---

## Skipped Tests (5)

| Test | File | Reason |
|------|------|--------|
| Ctrl+N creates new terminal | keyboard-shortcuts.spec.ts:79 | Marked `.skip()` |
| no terminals shows empty state | state-transitions.spec.ts:25 | Marked `.skip()` |
| clicking "+ New Terminal" creates terminal | state-transitions.spec.ts:52 | Marked `.skip()` |
| switching projects preserves UI state | state-transitions.spec.ts:192 | Marked `.skip()` |
| empty state disappears when terminal added | state-transitions.spec.ts:216 | Marked `.skip()` |

---

## Passed Tests (20)

### Form Inputs (8/8)
- Terminal title: double-click edit, Enter save, Escape cancel, blur save
- Settings: terminal limit presets, custom input, theme selector, render mode

### Keyboard Shortcuts (6/8)
- Alt+2, Alt+3 project switching works
- Alt+9 ignored when <9 projects
- Ctrl+W closes terminal
- Edge cases: shortcuts after click, rapid key handling

### State Transitions (6/8)
- Empty states: no projects shows welcome/hint
- Toast: container exists, limit toast appears
- Error states: invalid path warning, graceful transitions

---

## Critical Issues

1. **Locator ambiguity in Alt+1 test** - Quick fix available (use data-testid instead of class selector)

---

## Recommendations

1. **Fix Alt+1 test** - Replace line 27 with:
   ```ts
   const activeTab = window.getByTestId('project-tab-test-project-1')
   ```
2. **Review skipped tests** - 5 tests marked `.skip()` need implementation or removal
3. **Standardize selectors** - Prefer `getByTestId()` over class-based selectors for stability

---

## Unresolved Questions

- Why are 5 tests skipped? Are they WIP or require features not yet implemented?
