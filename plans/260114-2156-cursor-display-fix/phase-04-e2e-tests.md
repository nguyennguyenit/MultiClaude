# Phase 4: E2E Test Coverage

## Context Links
- [Plan Overview](./plan.md)
- [Phase 1: Atomic State](./phase-01-atomic-state-update.md)
- [Phase 2: Visibility Focus](./phase-02-visibility-focus-trigger.md)
- [Phase 3: WebGL-Aware Focus](./phase-03-webgl-aware-focus.md)

## Overview
**Priority:** P2 (Medium)
**Status:** pending
**Effort:** 1h

Add E2E tests for multi-project switching to prevent regression. Cover A->B, B->A, and A->B->C->A patterns.

## Key Insights
- Existing E2E tests use Playwright
- `__APP_STORE__` exposed globally for test access
- Need to verify: cursor visible, terminal focused, correct project active
- Cursor visibility: Check for `.xterm-cursor` element visibility
- Focus state: Check `document.activeElement` or terminal container focus

## Requirements
### Functional
- Test 2-project switch (A->B->A)
- Test 3+ project switch (A->B->C->A)
- Verify cursor visible after each switch
- Verify correct terminal focused

### Non-Functional
- Tests run in CI pipeline
- Reasonable timeout (500ms per switch sufficient)

## Architecture

```typescript
// e2e/project-switching.spec.ts
test.describe('Project Switching', () => {
  test('cursor visible after A->B switch', async ({ page }) => {
    // Setup: Add 2 projects with terminals
    // Action: Switch from A to B
    // Assert: Cursor visible in B's terminal
  })

  test('cursor visible after A->B->A switch', async ({ page }) => {
    // The key regression test
  })

  test('cursor visible after A->B->C->A switch', async ({ page }) => {
    // 3+ project pattern
  })
})
```

## Related Code Files
**Create:**
- `src/__tests__/e2e/project-switching.spec.ts`

**Reference:**
- `src/renderer/stores/app-store.ts` - `__APP_STORE__` global
- Existing E2E test patterns in `src/__tests__/e2e/`

## Implementation Steps

1. **Create test file**
   - `src/__tests__/e2e/project-switching.spec.ts`

2. **Test setup helper**
   - Create projects via `__APP_STORE__.getState().addProject()`
   - Create terminals via `window.electron.terminal.create()`
   - Wait for terminal initialization

3. **Implement test cases**
   - `cursor visible after A->B switch`
   - `cursor visible after A->B->A switch` (key case)
   - `cursor visible after A->B->C->A switch`
   - `rapid switching doesn't break cursor`

4. **Cursor visibility assertion**
   - Check `.xterm-cursor-block` or `.xterm-cursor-bar` exists
   - Check cursor element is visible (not display:none)
   - Or: Use ANSI query and response pattern

## Todo List
- [ ] Create `project-switching.spec.ts`
- [ ] Implement project/terminal setup helper
- [ ] Test: A->B switch cursor visible
- [ ] Test: A->B->A switch cursor visible (regression test)
- [ ] Test: A->B->C->A switch cursor visible
- [ ] Test: Rapid switching (10x) doesn't break
- [ ] Verify tests pass in CI

## Success Criteria
- All tests pass locally
- Tests integrated into CI pipeline
- < 5s total test runtime
- Catches regression if cursor fix reverted

## Risk Assessment
| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| Flaky tests | Medium | Medium | Use appropriate wait times |
| CI environment differences | Low | Low | Use consistent Electron version |
| Cursor selector changes | Low | Low | Use data-testid if needed |

## Security Considerations
- None - test code only, not shipped

## Next Steps
- Run full test suite
- Monitor CI for flakiness
- Document any edge cases discovered
