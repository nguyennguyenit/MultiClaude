# Phase 5: Cleanup Old Sidebar and Final Polish

## Overview

- **Priority:** P2
- **Status:** pending
- **Effort:** 0.5h

Remove deprecated sidebar components. Update imports. Final testing and polish.

## Key Insights

- Old sidebar folder can be deleted after activity bar is complete
- Need to update all imports referencing old sidebar
- Test edge cases: 0 projects, 12 terminals, macOS/Windows/Linux

## Requirements

### Functional
- Remove all old sidebar code
- Ensure no broken imports
- Terminal header unchanged (keep existing style)

### Non-Functional
- Clean git history (single cleanup commit)
- No dead code remaining

## Related Code Files

### Files to Delete
- `src/renderer/components/sidebar/sidebar.tsx`
- `src/renderer/components/sidebar/sidebar-header.tsx`
- `src/renderer/components/sidebar/navigation-item.tsx`
- `src/renderer/components/sidebar/user-account-card.tsx`
- `src/renderer/components/sidebar/index.ts`

### Files to Update
- `src/renderer/App.tsx` - Update imports
- Any file importing from `./components/sidebar`

### Files to Keep (verify no changes needed)
- `src/renderer/components/terminal/terminal-action-bar.tsx` - Keep as-is
- `src/renderer/components/terminal/terminal-pane.tsx` - Header styling unchanged

## Implementation Steps

### Step 1: Search for old sidebar imports
```bash
grep -r "from.*sidebar" src/renderer/
grep -r "sidebarOpen\|sidebarCollapsed" src/renderer/
```

### Step 2: Update App.tsx imports
```typescript
// Remove:
import { Sidebar } from './components/sidebar'

// Add:
import { ActivityBar } from './components/activity-bar'
```

### Step 3: Delete sidebar folder
```bash
rm -rf src/renderer/components/sidebar/
```

### Step 4: Verify build
```bash
npm run typecheck
npm run build
```

### Step 5: Test checklist
- [ ] App starts without errors
- [ ] Activity bar shows correctly
- [ ] All 3 states work
- [ ] Ctrl+B toggles
- [ ] Terminal view works
- [ ] GitHub view works
- [ ] Settings modal opens
- [ ] macOS traffic lights visible
- [ ] Project tabs work
- [ ] Add project works

### Step 6: Final polish items
- Verify badge counts update in real-time
- Check tooltip positioning
- Test with different themes
- Test terminal style mode

## Todo List

- [ ] Find and update all sidebar imports
- [ ] Update App.tsx to use ActivityBar
- [ ] Delete old sidebar folder
- [ ] Run typecheck and build
- [ ] Test on all platforms (if available)
- [ ] Test all 7 color themes
- [ ] Test terminal UI style mode
- [ ] Create cleanup commit

## Success Criteria

- No compilation errors
- No runtime errors
- Activity bar fully functional
- Old sidebar code removed
- Clean build output

## Security Considerations

- None

## Verification Commands

```bash
# Type check
npm run typecheck

# Build
npm run build

# Dev test
npm run electron:dev

# Search for any remaining old references
grep -r "sidebarOpen\|sidebarCollapsed\|toggleSidebar" src/
```

## Post-Implementation

After all phases complete:
1. Update `docs/system-architecture.md` - Rename sidebar references to activity bar
2. Update `docs/codebase-summary.md` if it exists
3. Consider adding activity bar states to keyboard shortcuts documentation
