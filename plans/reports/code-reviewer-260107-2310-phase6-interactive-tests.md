# Code Review: Phase 6 - Interactive & Keyboard Tests

**Score: 8/10**

## Scope
- Files reviewed: 5 (terminal-grid.tsx, App.tsx, keyboard-shortcuts.spec.ts, form-inputs.spec.ts, state-transitions.spec.ts)
- Lines analyzed: ~600
- Focus: Phase 6 changes (keyboard shortcuts, form inputs, state transitions)

## Overall Assessment
Solid implementation. Component changes minimal and correct. Test coverage comprehensive with appropriate skip markers for flaky tests. No security issues. Minor improvements possible.

---

## Critical Issues (Blocking)
None.

---

## High Priority (Should Fix)

### 1. ESLint excludes needed for test-results folder
```
/src/__tests__/e2e/test-results/html-report/trace/assets/*.js
```
These generated files are triggering lint errors. Add to `.eslintignore`:
```
src/__tests__/e2e/test-results/
```

---

## Medium Priority (Warnings)

### 1. Unused variable in form-inputs.spec.ts
Line 47 & 69: `originalTitle` captured but not always used
```typescript
const originalTitle = await terminalTitle.textContent()  // line 47
```
Fix: Remove unused capture or use in assertion

### 2. Magic numbers in timeouts
Multiple `waitForTimeout(150)`, `waitForTimeout(200)`, `waitForTimeout(300)` with no explanation
```typescript
// Better: define constants
const TRANSITION_DELAY = 150
const STATE_SETTLE_DELAY = 200
```

### 3. Soft assertions in state-transitions.spec.ts
Lines 131-135, 158-164 use loose checks:
```typescript
expect(terminalCount > 0 || toastVisible).toBeTruthy()
```
Consider more explicit assertions when possible

---

## Low Priority (Suggestions)

### 1. Test isolation could be improved
- Some tests depend on prior state from `beforeEach`
- Consider explicit state setup per test

### 2. Locator selectors could be more robust
Using `[class*="bg-[var(--mc-bg-primary)]"]` is fragile
```typescript
// Better: add data-testid for active states
data-testid="project-tab-active"
```

### 3. Consider shared wait utility
```typescript
// util: waitForElement(locator, timeout)
// would reduce boilerplate
```

---

## Positive Observations

1. **Appropriate skip markers** - Flaky tests marked with clear reasons
2. **Clean prop threading** - `onTitleChange` properly passed through component hierarchy
3. **Good test organization** - Logical grouping by feature (keyboard, forms, states)
4. **Edge cases covered** - Alt+9 on 3 projects, rapid shortcuts, blur save
5. **DRY fixtures** - Shared `mockProject`, `injectMockProject` utilities

---

## Recommended Actions

1. **Add** `test-results/` to `.eslintignore` (5 min)
2. **Remove** unused `originalTitle` variable in form-inputs.spec.ts (2 min)
3. **Consider** extracting timeout constants for maintainability
4. **Optional**: Add `data-testid` for active tab states

---

## Metrics
- TypeScript: PASS (no errors)
- ESLint: 3 real issues in fixtures (rest are generated files)
- Test structure: Well organized, appropriately skipped flaky tests
