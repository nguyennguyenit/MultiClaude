# Phase 06: Testing

## Context
- Parent: [plan.md](./plan.md)
- Depends on: Phase 01-05

## Overview
- **Priority**: Medium
- **Status**: Complete ✅ 2026-01-18
- **Effort**: 1h
- **Description**: Manual testing and E2E test updates

## Key Insights
- Run typecheck and linting first
- Manual testing of all terminal style combinations
- Update E2E tests for new settings UI
- Visual regression tests for terminal mode

## Requirements

### Functional
- All 3 color presets work
- All 6 fonts render correctly
- Border toggle works
- Settings persist after restart
- Cancel reverts changes

### Non-Functional
- No TypeScript errors
- No console errors
- No visual regressions in Modern mode

## Testing Matrix

| Test Case | Steps | Expected |
|-----------|-------|----------|
| Toggle to Terminal | Settings → UI Style → Terminal | App turns green-on-black |
| Green preset | Terminal → Green | #00FF00 text, #001C00 bg |
| Blue preset | Terminal → Blue | #00BFFF text, #001020 bg |
| White preset | Terminal → White | #FFFFFF text, #000000 bg |
| Font: JetBrains | Select JetBrains Mono | Font changes |
| Font: VT323 | Select VT323 | Retro pixel font |
| Border: 1px solid | Default | Normal borders |
| Border: ASCII | Toggle ASCII | Box-drawing chars |
| Save | Click Save | Settings persist |
| Cancel | Make changes → Cancel | Reverts to saved |
| Restart | Close → Reopen app | Terminal mode loaded |

## Related Code Files

### Run
```bash
# Type check
npm run typecheck

# Lint
npm run lint

# Unit tests
npm test

# E2E tests
npm run test:ui
```

### Modify (if needed)
| File | Changes |
|------|---------|
| `src/__tests__/e2e/tests/settings.spec.ts` | Add terminal style tests |
| `src/__tests__/e2e/tests/themes.spec.ts` | Add terminal mode visual tests |

## Implementation Steps

1. Run type check:
   ```bash
   npm run typecheck
   ```
   Fix any TypeScript errors

2. Run linting:
   ```bash
   npm run lint
   ```
   Fix any linting errors

3. Start dev server:
   ```bash
   npm run electron:dev
   ```

4. Manual testing checklist:
   - [ ] Open Settings → Appearance
   - [ ] Click Terminal in UI Style section
   - [ ] Verify app switches to terminal mode
   - [ ] Test all 3 color presets
   - [ ] Test all 6 fonts
   - [ ] Test border toggle
   - [ ] Click Save, restart app, verify persistence
   - [ ] Make changes, click Cancel, verify revert
   - [ ] Switch back to Modern, verify normal appearance

5. Component testing:
   - [ ] All modals styled correctly
   - [ ] All dialogs styled correctly
   - [ ] Tooltips styled correctly
   - [ ] Sidebar styled correctly
   - [ ] Terminal panes styled correctly
   - [ ] Project tabs styled correctly

6. Update E2E tests if time permits:
   ```typescript
   // settings.spec.ts
   test('should toggle to terminal UI style', async ({ electronApp, page }) => {
     // Open settings
     await page.click('[data-testid="settings-button"]')
     // Click Terminal style
     await page.click('text=Terminal')
     // Verify class applied
     const html = await page.locator('html')
     await expect(html).toHaveClass(/ui-terminal/)
   })
   ```

## Todo List
- [ ] Run typecheck - fix errors
- [ ] Run lint - fix warnings
- [ ] Manual test: Toggle to Terminal
- [ ] Manual test: All 3 color presets
- [ ] Manual test: All 6 fonts
- [ ] Manual test: Border toggle
- [ ] Manual test: Save persistence
- [ ] Manual test: Cancel revert
- [ ] Manual test: All components styled
- [ ] (Optional) Add E2E tests
- [ ] (Optional) Add visual regression snapshots

## Success Criteria
- No TypeScript errors
- No linting errors
- All manual tests pass
- Settings persist correctly
- No regression in Modern mode

## Risk Assessment
| Risk | Mitigation |
|------|------------|
| Hidden components not styled | Thorough manual testing |
| Font loading race condition | Check document.fonts.ready |

## Definition of Done
1. All phases complete
2. All tests pass
3. Feature ready for user review
