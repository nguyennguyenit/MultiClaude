# Phase 03: Activity Bar Component with View Switching

## Context Links

- [Current Sidebar](/home/plateau/Desktop/Claude Code/MultiClaude/src/renderer/components/sidebar/sidebar.tsx)
- [NavigationItem](/home/plateau/Desktop/Claude Code/MultiClaude/src/renderer/components/sidebar/navigation-item.tsx)
- [UserAccountCard](/home/plateau/Desktop/Claude Code/MultiClaude/src/renderer/components/sidebar/user-account-card.tsx)
- [App Store](/home/plateau/Desktop/Claude Code/MultiClaude/src/renderer/stores/app-store.ts)
- [Phase 01](./phase-01-state-management-and-store-updates.md)

## Overview

- **Priority:** P1
- **Status:** pending
- **Effort:** 3h
- **Depends on:** Phase 01

Build VS Code-style Activity Bar with icons, badges, view switching, and 3-state behavior.

## Key Insights

- VS Code Activity Bar: vertical icon strip on left edge
- Active view has left highlight bar (accent color, 2px)
- Icons have tooltip on hover when collapsed
- Badges show counts (terminal count, git changes)
- Bottom section: Account, Settings, Expand/Collapse toggle

## Requirements

### Functional

- FR-01: 3 width states: collapsed (48px), expanded (200px), hidden (0px)
- FR-02: Navigation icons: Terminals (with count badge), GitHub (with changes badge)
- FR-03: Click icon = switch to that view + highlight
- FR-04: Bottom icons: Account, Settings (with update dot), Toggle button
- FR-05: Toggle button cycles states: collapsed → expanded → hidden → collapsed
- FR-06: Hover left edge (when hidden) shows Activity Bar temporarily
- FR-07: Expanded state shows icon + label for all items

### Non-functional

- NFR-01: Smooth 200ms width transition
- NFR-02: Icons remain centered during transition
- NFR-03: Preserve existing UserAccountCard functionality

## Architecture

```
Activity Bar Structure (expanded state):
┌──────────────────────┐
│ ┌──┐                 │
│ │📺│ Terminals  [3]  │ ← View icons with badge
│ └──┘                 │
│ ┌──┐                 │
│ │🐙│ GitHub     [2]  │
│ └──┘                 │
│                      │
│   ─────spacer─────   │
│                      │
│ ┌──┐                 │
│ │👤│ @username       │ ← Account section
│ └──┘  Sign out       │
│ ┌──┐                 │
│ │⚙️│ Settings    •   │ ← Update dot
│ └──┘                 │
│ ┌──┐                 │
│ │◀│ Collapse         │ ← Toggle button
│ └──┘                 │
└──────────────────────┘

Collapsed state (48px):
┌────┐
│ 📺 │ [3]
│ 🐙 │ [2]
│    │
│ 👤 │
│ ⚙️ │ •
│ ◀ │
└────┘

Hidden state (0px):
│ (hover zone 8px)
```

## Related Code Files

### To Create

| File | Purpose |
|------|---------|
| `src/renderer/components/activity-bar/activity-bar.tsx` | Main container component |
| `src/renderer/components/activity-bar/activity-bar-item.tsx` | Single navigation item with badge |
| `src/renderer/components/activity-bar/activity-bar-account-section.tsx` | Adapted from UserAccountCard |
| `src/renderer/components/activity-bar/activity-bar-toggle-button.tsx` | State cycle button |
| `src/renderer/components/activity-bar/index.ts` | Exports |

### To Modify

| File | Change |
|------|--------|
| `src/renderer/App.tsx` | Replace `<Sidebar />` with `<ActivityBar />` |
| `src/renderer/styles/globals.css` | Add Activity Bar CSS variables |

### To Delete (after verification)

| File | Reason |
|------|--------|
| `src/renderer/components/sidebar/` | Replaced by activity-bar |

## Implementation Steps

1. **Add CSS variables to globals.css**
   ```css
   :root {
     --mc-activity-bar-width-collapsed: 48px;
     --mc-activity-bar-width-expanded: 200px;
     --mc-activity-bar-transition: 200ms ease-in-out;
   }
   ```

2. **Create activity-bar-item.tsx**
   ```typescript
   interface ActivityBarItemProps {
     icon: ReactNode
     label: string
     badge?: number
     active: boolean
     collapsed: boolean
     onClick: () => void
   }
   ```
   - Show left highlight bar (2px) when active
   - Badge positioned top-right of icon
   - Tooltip on hover when collapsed

3. **Create activity-bar-toggle-button.tsx**
   - Icon changes based on state:
     - collapsed: `▶` (expand)
     - expanded: `◀` (collapse)
     - hidden: not rendered (use hover zone)
   - Click cycles to next state

4. **Create activity-bar-account-section.tsx**
   - Simplified version of UserAccountCard
   - Shows avatar + username when expanded
   - Shows avatar only when collapsed
   - Sign out button (expanded only)

5. **Create activity-bar.tsx**
   - Read activityBarState from store
   - Render width based on state
   - Hidden state: render 8px hover zone that expands on hover
   - Structure: nav items → spacer → account → settings → toggle

6. **Update App.tsx**
   - Import ActivityBar instead of Sidebar
   - Pass necessary props (projectPath, terminal count, git changes)

## Todo List

- [ ] Add CSS variables to globals.css
- [ ] Create activity-bar-item.tsx with badge support
- [ ] Create activity-bar-toggle-button.tsx
- [ ] Create activity-bar-account-section.tsx
- [ ] Create activity-bar.tsx main component
- [ ] Create index.ts exports
- [ ] Update App.tsx to use ActivityBar
- [ ] Test 3-state transitions
- [ ] Test view switching
- [ ] Test badge updates
- [ ] Test hover reveal for hidden state
- [ ] Verify tooltips work on collapsed state

## Success Criteria

- [ ] Activity Bar renders at correct width for each state
- [ ] Terminals icon shows terminal count badge
- [ ] GitHub icon shows changes count badge
- [ ] Clicking nav icon switches view and highlights
- [ ] Toggle button cycles through all 3 states
- [ ] Hidden state has hover zone that reveals bar
- [ ] Smooth 200ms animations
- [ ] Account section shows GitHub info
- [ ] Settings button opens settings modal
- [ ] Update dot shows when update available

## Risk Assessment

| Risk | Impact | Mitigation |
|------|--------|------------|
| UserAccountCard complexity | High | Start with simplified version, iterate |
| Badge positioning in collapsed | Medium | Use absolute positioning with offset |
| Hover zone conflicts with content | Medium | Use pointer-events carefully |

## Security Considerations

None - UI component only. GitHub auth handled by existing code.

## Next Steps

After completion:
- Phase 04: Persist state to settings
- Phase 05: Polish animations
- Delete old sidebar/ directory
