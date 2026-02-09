# Code Review: Phase 2 Core UI E2E Tests

**Date:** 2026-01-07
**Reviewer:** code-reviewer
**Status:** APPROVED with minor recommendations

---

## Code Review Summary

### Scope
- **Files reviewed:** 8 files
  - `src/__tests__/e2e/tests/sidebar.spec.ts` (6 tests)
  - `src/__tests__/e2e/tests/settings.spec.ts` (8 tests)
  - `src/__tests__/e2e/tests/project-tabs.spec.ts` (8 tests)
  - `src/__tests__/e2e/fixtures/electron-app.ts` (helper functions)
  - `src/__tests__/e2e/fixtures/test-data.ts` (mock data)
  - `src/renderer/components/sidebar/sidebar.tsx`
  - `src/renderer/components/settings/settings-modal.tsx`
  - `src/renderer/components/project-tabs/project-tabs.tsx`
- **Lines analyzed:** ~650 LOC
- **Test count:** 22 tests (all passing per user report)

### Overall Assessment

**Quality: GOOD** - Well-structured E2E tests with proper data-testid usage, consistent patterns, and reasonable coverage of core UI components. Minor improvements suggested.

---

## Critical Issues
None identified.

---

## High Priority Findings

### H1. Fragile CSS Class Selectors in Some Tests

**Files:** `sidebar.spec.ts`, `project-tabs.spec.ts`

Some tests rely on CSS class names which can break on style changes:

```typescript
// sidebar.spec.ts:64 - Uses CSS class selector
const tooltip = window.locator('.absolute.left-full').first()

// project-tabs.spec.ts:125 - Checks for specific Tailwind class
expect(firstTabClass).toContain('bg-[var(--mc-bg-primary)]')
```

**Impact:** Tests may fail on CSS refactors even if functionality unchanged.

**Recommendation:** For tooltip, add `data-testid="sidebar-tooltip"`. For active tab, consider checking for `data-active="true"` attribute instead of CSS classes.

---

### H2. Hardcoded Timeouts Instead of Waiting for Elements

**Files:** All spec files

Multiple instances of `waitForTimeout()` instead of proper element waits:

```typescript
await window.waitForTimeout(200) // Multiple occurrences
await window.waitForTimeout(300) // For sidebar transition
```

**Impact:** Tests may be flaky on slower CI machines or pass too slowly on fast machines.

**Recommendation:** Prefer `waitForSelector()` or `expect().toBeVisible()` with proper timeout. Example:
```typescript
// Instead of:
await window.waitForTimeout(300)
// Use:
await sidebar.waitFor({ state: 'visible' })
```

---

## Medium Priority Improvements

### M1. Tooltip Test Has Weak Assertion

**File:** `sidebar.spec.ts:67`

```typescript
const tooltipCount = await tooltip.count()
expect(tooltipCount).toBeGreaterThanOrEqual(0) // Always passes!
```

**Impact:** Test doesn't actually verify tooltip functionality.

**Recommendation:** Either verify tooltip is visible on hover or mark test as incomplete.

---

### M2. Conditional Test Logic May Hide Failures

**Files:** `settings.spec.ts`, `project-tabs.spec.ts`

```typescript
// settings.spec.ts:99
if (await darkModeButton.isVisible()) {
  // Test logic only runs if condition met
}

// project-tabs.spec.ts:74
if (await overflowButton.isVisible()) {
  await expect(overflowButton).toContainText('+1')
}
```

**Impact:** Tests silently pass when conditions not met, hiding potential bugs.

**Recommendation:** Add assertions or test.skip with reason when conditions not met.

---

### M3. Missing data-testid for Some UI Elements

**Current coverage is good but could improve:**
- Navigation items lack `data-testid` (uses `getByRole` which is acceptable)
- Individual shortcut badges lack `data-testid`
- Update badge indicator lacks `data-testid`

---

### M4. Mock Project Paths Use `/tmp` Which May Not Exist

**File:** `test-data.ts`

```typescript
path: '/tmp/test-project'
```

**Impact:** On Windows, `/tmp` doesn't exist and tests relying on path validation may fail.

**Recommendation:** Consider using `process.platform` or mock paths that don't require filesystem access.

---

## Low Priority Suggestions

### L1. Test Descriptions Could Be More Specific

```typescript
// Current
test('sidebar renders expanded by default with width > 200px', ...)

// Suggested (more descriptive)
test('should render sidebar expanded (>200px width) on initial load', ...)
```

---

### L2. DRY Improvement - Repeated Modal Open Pattern

Settings tests repeat the same modal-open pattern 8 times:

```typescript
const settingsButton = window.locator('[data-testid="settings-button"]')
await settingsButton.click()
await window.waitForTimeout(200)
```

**Recommendation:** Extract to helper function `openSettingsModal(window)`.

---

### L3. Consider Adding Test Tags for CI Filtering

Add `@smoke`, `@critical` tags for selective test runs:

```typescript
test('settings modal opens when settings button clicked @smoke', ...)
```

---

## Positive Observations

1. **Consistent data-testid naming** - Uses kebab-case pattern: `settings-modal`, `settings-tab-appearance`, `project-tabs-container`

2. **Good test isolation** - Each test uses `beforeEach` to inject fresh mock data

3. **Comprehensive modal testing** - Tests all 4 close methods (X button, Cancel, Save, backdrop click)

4. **Smart store injection** - `injectMockProject` helper directly manipulates Zustand store, avoiding IPC complexity

5. **Proper accessibility attributes** - Components include `aria-label` for buttons (e.g., "Remove project", "Expand sidebar")

6. **Well-structured test data** - `test-data.ts` provides reusable fixtures with proper typing

7. **Keyboard shortcut coverage** - Tests verify Alt+N badge visibility on project tabs

8. **Overflow dropdown testing** - Tests both trigger (+N indicator) and menu functionality

---

## Recommended Actions

1. **[HIGH]** Replace CSS class selectors with data-testid attributes where possible
2. **[HIGH]** Replace `waitForTimeout()` with element-based waits
3. **[MEDIUM]** Fix weak tooltip assertion (line 67 in sidebar.spec.ts)
4. **[MEDIUM]** Add assertions or skip conditions to conditional test blocks
5. **[LOW]** Extract repeated modal-open pattern to helper function

---

## Metrics

| Metric | Value |
|--------|-------|
| Test Count | 22 |
| Components Covered | 3 (Sidebar, Settings, ProjectTabs) |
| data-testid Usage | ~20 unique IDs |
| Fragile Selectors | 3 instances |
| Hardcoded Timeouts | ~15 instances |

---

## Verdict

**APPROVED** - Tests provide good coverage of Phase 2 Core UI components. The implementation follows consistent patterns and properly uses data-testid attributes for reliable element selection. High-priority items should be addressed in a follow-up PR to improve test reliability.

---

## Unresolved Questions

1. Should navigation items (`Terminals`, `GitHub`) have explicit data-testid, or is `getByRole` sufficient?
2. Is 200-300ms timeout sufficient for CI environments, or should we increase to 500ms?
3. Should we add ESC key close test for settings modal (handler exists in code)?
