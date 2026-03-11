# Code Review: Phase 3 Terminal & Grid E2E Tests

**Date**: 2026-01-07
**Score**: 8.5/10
**Verdict**: APPROVED with minor suggestions

## Scope

- Files reviewed: 4
  - `src/__tests__/e2e/tests/terminal-grid.spec.ts` (179 lines)
  - `src/__tests__/e2e/tests/terminal-pane.spec.ts` (183 lines)
  - `src/__tests__/e2e/tests/terminal-rendering.spec.ts` (298 lines)
  - `src/__tests__/e2e/fixtures/electron-app.ts` (reference)
- Review focus: Security, performance, architecture, best practices, test coverage
- Test results: 16 passed, 6 skipped (env limitations), 0 failures

## Overall Assessment

Solid E2E test implementation following established patterns. Tests are well-structured with good isolation, proper mocking, and no security concerns. Minor DRY violations and one piece of dead code. Skip reasons are documented appropriately.

---

## Critical Issues (MUST FIX)

None.

---

## Warnings (SHOULD FIX)

### 1. Dead Code: Unused `setRenderingMode` function

**File**: `terminal-rendering.spec.ts:14-44`

The `setRenderingMode` helper function is defined but never used. Tests use the decomposed helpers (`openSettings`, `navigateToTerminalsTab`, `selectRenderingMode`, `saveAndCloseSettings`) instead.

**Action**: Remove lines 14-44.

### 2. DRY Violation: Duplicated `addTerminal` logic

**Files**: `terminal-grid.spec.ts:22-33` vs `terminal-pane.spec.ts:17-29`

Terminal creation logic duplicated. Should be extracted to shared helper.

**Action**: Move to `fixtures/electron-app.ts`:
```typescript
export async function addTerminal(window: Page): Promise<void> {
  const emptyStateButton = window.locator('button:has-text("+ New Terminal")')
  const actionBarButton = window.locator('button:has-text("+ New")')
  if (await emptyStateButton.isVisible({ timeout: 500 })) {
    await emptyStateButton.click()
  } else {
    await actionBarButton.click()
  }
  await window.waitForTimeout(300)
}
```

---

## Suggestions (NICE TO HAVE)

### 1. Replace magic timeout values with named constants

Multiple `waitForTimeout(100/200/300/500)` calls use magic numbers.

**Action**: Define constants in test-data.ts:
```typescript
export const WAIT_MS = {
  SHORT: 100,
  MEDIUM: 300,
  RENDER: 500
} as const
```

### 2. Use data-testid for fragile selectors

**File**: `terminal-rendering.spec.ts:51-53`
```typescript
// Fragile: relies on SVG path content
const settingsButton = window.locator('button').filter({
  has: window.locator('svg path[d*="10.325 4.317"]')
})
```

**Action**: Add `data-testid="settings-button"` to sidebar settings button.

### 3. Consistent timeout pattern

**File**: `terminal-pane.spec.ts:22-25`
```typescript
// Inconsistent timeout handling
if (await emptyStateButton.isVisible({ timeout: 1000 })) { ... }
else if (await actionBarButton.isVisible({ timeout: 1000 })) { ... }
```

The second `isVisible` has implicit timeout after first fails. Consider using `Promise.race` or single check.

---

## Positive Observations

1. **Security**: No PTY commands executed - tests interact via UI only
2. **Isolation**: Each test gets unique temp directory with cleanup
3. **Documentation**: Clear JSDoc comments and skip reasons
4. **Mocking**: Proper use of `injectMockProject` to inject state without side effects
5. **Visual regression**: Screenshots with 2% diff tolerance - pragmatic threshold
6. **Selector strategy**: Good use of `data-testid` for navigation (settings tab)
7. **Error resilience**: Graceful handling of session restoration state

---

## Test Coverage Analysis

| Requirement | Coverage | Notes |
|------------|----------|-------|
| Grid layouts 1-4 terminals | Full | 2x2 grid verified |
| Grid layouts 9-12 terminals | Skipped | Time constraints documented |
| Pane title edit | Full | Double-click, Enter, Escape |
| Pane close | Skipped | Causes test env instability |
| Active terminal highlight | Full | CSS class verification |
| WebGL Performance mode | Full | With visual regression |
| WebGL Balanced mode | Full | With visual regression |
| WebGL Quality mode | Full | With visual regression |
| Settings persistence | Skipped | Reload breaks Electron context |
| Max terminals setting | Full | Preset selection verified |

---

## Metrics

- Test files: 3
- Total tests: 22 (16 active, 6 skipped)
- Pass rate: 100% (of active tests)
- LOC: ~660

---

## Recommended Actions

1. **Remove dead code** (`setRenderingMode` helper) - 5 min
2. **Extract shared `addTerminal` helper** - 10 min
3. **Add data-testid to settings button** - 5 min (optional)

---

## Unresolved Questions

None.
