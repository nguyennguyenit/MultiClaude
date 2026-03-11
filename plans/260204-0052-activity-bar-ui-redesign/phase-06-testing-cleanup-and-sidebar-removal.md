# Phase 06: Testing, Cleanup, and Sidebar Removal

## Context Links

- [Old Sidebar Directory](/home/plateau/Desktop/Claude Code/MultiClaude/src/renderer/components/sidebar/)
- [Code Standards](/home/plateau/Desktop/Claude Code/MultiClaude/docs/code-standards.md)
- [All Phases](./plan.md)

## Overview

- **Priority:** P2
- **Status:** pending
- **Effort:** 0.5h
- **Depends on:** Phases 01-05

Final verification, remove old sidebar code, update tests.

## Key Insights

- Old sidebar has 5 files to remove
- App.tsx imports need updating
- E2E tests may reference sidebar data-testid
- TypeScript should catch any missed references

## Requirements

### Functional

- FR-01: All Activity Bar features work correctly
- FR-02: No references to old sidebar code remain
- FR-03: Tests pass with new component structure

### Non-functional

- NFR-01: No dead code in bundle
- NFR-02: Clean git diff (no accidental deletions)

## Files to Delete

| File | Reason |
|------|--------|
| `src/renderer/components/sidebar/sidebar.tsx` | Replaced by activity-bar.tsx |
| `src/renderer/components/sidebar/sidebar-header.tsx` | Logo moved to titlebar |
| `src/renderer/components/sidebar/navigation-item.tsx` | Replaced by activity-bar-item.tsx |
| `src/renderer/components/sidebar/user-account-card.tsx` | Adapted to activity-bar-account-section.tsx |
| `src/renderer/components/sidebar/index.ts` | No longer needed |

## Files to Update

| File | Change |
|------|--------|
| `src/renderer/App.tsx` | Remove Sidebar import if still present |
| Any test files | Update data-testid references |

## Implementation Steps

1. **Verify all features work**
   - [ ] Activity Bar renders in all 3 states
   - [ ] View switching works
   - [ ] Badges display correctly
   - [ ] Keyboard shortcut works (Ctrl+B)
   - [ ] Settings persist
   - [ ] Animations smooth
   - [ ] Hidden state hover works

2. **Search for sidebar references**
   ```bash
   grep -r "sidebar" src/renderer --include="*.tsx" --include="*.ts"
   grep -r "Sidebar" src/renderer --include="*.tsx" --include="*.ts"
   ```

3. **Delete old sidebar directory**
   ```bash
   rm -rf src/renderer/components/sidebar/
   ```

4. **Run TypeScript check**
   ```bash
   npm run typecheck
   ```

5. **Run tests**
   ```bash
   npm test
   ```

6. **Update any failing tests**
   - Change `data-testid="sidebar"` to `data-testid="activity-bar"`
   - Update test assertions for new structure

7. **Build and verify**
   ```bash
   npm run build
   ```

## Todo List

- [ ] Manual test all Activity Bar features
- [ ] Search codebase for sidebar references
- [ ] Delete sidebar directory
- [ ] Run typecheck
- [ ] Run tests and fix failures
- [ ] Build production bundle
- [ ] Test production build works
- [ ] Update changelog/roadmap if applicable

## Testing Checklist

### Activity Bar States
- [ ] Collapsed (48px) - icons only, tooltips on hover
- [ ] Expanded (200px) - icons + labels
- [ ] Hidden (0px) - hover zone reveals bar

### View Switching
- [ ] Click Terminals icon → Terminal view active
- [ ] Click GitHub icon → GitHub view active
- [ ] Active icon has left highlight

### Badges
- [ ] Terminal count shows on Terminals icon
- [ ] Badge updates when terminal added/removed
- [ ] Badge pulses on change

### Account Section
- [ ] Shows GitHub username when authenticated
- [ ] Shows avatar
- [ ] Sign out works (expanded only)

### Settings
- [ ] Settings button opens modal
- [ ] Update dot shows when available

### Keyboard Shortcut
- [ ] Ctrl+B (Cmd+B) cycles states
- [ ] Works regardless of focus

### Persistence
- [ ] State saved on change
- [ ] State restored on app restart

### Animations
- [ ] Width transitions smooth
- [ ] Hidden reveal animates
- [ ] Active indicator animates
- [ ] Respects prefers-reduced-motion

## Success Criteria

- [ ] No TypeScript errors
- [ ] All tests pass
- [ ] Production build succeeds
- [ ] No sidebar code remains
- [ ] App functions correctly end-to-end

## Risk Assessment

| Risk | Impact | Mitigation |
|------|--------|------------|
| Missed sidebar reference | Medium | TypeScript will catch import errors |
| Test failures | Low | Update test selectors |
| Regression in functionality | High | Thorough manual testing |

## Security Considerations

None - cleanup phase only.

## Post-Completion

After all phases complete:
1. Update `docs/codebase-summary.md` if it references sidebar
2. Consider updating screenshots in README
3. Tag release if applicable
