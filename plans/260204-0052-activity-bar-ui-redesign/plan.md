---
title: "Activity Bar UI Redesign"
description: "Replace sidebar with VS Code-style Activity Bar featuring 3 states (collapsed/expanded/hidden)"
status: completed
priority: P1
effort: 8h
branch: beta
tags: [ui, activity-bar, titlebar, sidebar-replacement]
created: 2026-02-04
completed: 2026-02-04
---

# Activity Bar UI Redesign

## Overview

Transform current sidebar into VS Code-style Activity Bar with 3 states, integrate project tabs into titlebar, and replace hamburger menu with app logo.

## Phase Summary

| Phase | Description | Effort | Status | File |
|-------|-------------|--------|--------|------|
| 01 | State Management & Store Updates | 1h | completed | [phase-01](./phase-01-state-management-and-store-updates.md) |
| 02 | Titlebar Redesign (Logo + Project Tabs) | 1.5h | completed | [phase-02](./phase-02-titlebar-redesign-with-logo-and-project-tabs.md) |
| 03 | Activity Bar Component | 3h | completed | [phase-03](./phase-03-activity-bar-component-with-view-switching.md) |
| 04 | Settings Integration & Persistence | 1h | completed | [phase-04](./phase-04-settings-integration-and-state-persistence.md) |
| 05 | Animations & Polish | 1h | completed | [phase-05](./phase-05-animations-transitions-and-visual-polish.md) |
| 06 | Testing & Cleanup | 0.5h | completed | [phase-06](./phase-06-testing-cleanup-and-sidebar-removal.md) |

## Key Dependencies

- Phase 02 depends on Phase 01 (state for hidden detection)
- Phase 03 depends on Phase 01 (ActivityBar state enum)
- Phase 04 depends on Phases 01-03
- Phase 05-06 depend on all prior phases

## Architecture Changes

```
Current Layout:
┌─────────────────────────────────────┐
│ Titlebar [☰ menu]  "MultiClaude"    │ h-10
├─────────────────────────────────────┤
│ Project Tabs [1|2|3...] [+]         │ h-9
├────────┬────────────────────────────┤
│Sidebar │ Terminal/GitHub View       │ flex-1
│(200px) │                            │
└────────┴────────────────────────────┘

New Layout:
┌─────────────────────────────────────┐
│ [Logo] Project Tabs [1|2|3...] [+]  │ h-10 (titlebar-drag)
├───────┬─────────────────────────────┤
│Activity│ Terminal/GitHub View       │ flex-1
│  Bar   │                            │
│ 48/200 │                            │
└───────┴─────────────────────────────┘
```

## Files to Create

1. `src/renderer/components/activity-bar/activity-bar.tsx`
2. `src/renderer/components/activity-bar/activity-bar-item.tsx`
3. `src/renderer/components/activity-bar/activity-bar-account-section.tsx`
4. `src/renderer/components/activity-bar/index.ts`

## Files to Modify

1. `src/renderer/App.tsx` - Layout restructure
2. `src/renderer/stores/app-store.ts` - New state enum
3. `src/renderer/stores/settings-store.ts` - Persistence
4. `src/renderer/components/project-tabs/project-tabs.tsx` - Embed in titlebar
5. `src/renderer/styles/globals.css` - New CSS variables
6. `src/shared/types/settings.ts` - Add activityBarState type

## Files to Delete/Deprecate

1. `src/renderer/components/sidebar/` - Replace entirely (after Phase 03 verified)

## Success Criteria

- [x] Activity Bar has 3 states: collapsed (48px), expanded (200px), hidden (0px)
- [x] Logo shows icon-only when collapsed, icon+text when expanded
- [x] Project tabs render inside titlebar after logo
- [x] Terminals icon shows badge with terminal count
- [ ] GitHub icon shows badge with changes count (deferred - needs git status integration)
- [x] View switching works (click icon = switch view)
- [x] Active icon has left highlight bar
- [x] Keyboard shortcut Ctrl+B toggles states
- [x] State persists across sessions
- [x] Hover left edge reveals hidden activity bar
- [x] Smooth 200ms animations for all state transitions

## Execution Order

```
Phase 01 (Foundation)
    ↓
Phase 02 (Titlebar) ──┬── Phase 03 (Activity Bar)
                      │         ↓
                      └────→ Phase 04 (Persistence)
                                 ↓
                            Phase 05 (Polish)
                                 ↓
                            Phase 06 (Cleanup)
```

## Unresolved Questions

1. **Badge for GitHub changes**: How to compute "changes count"? Options:
   - Uncommitted files count (from git status)
   - PR review requests count (from GitHub API)
   - Recommendation: Use uncommitted files count (already available from git status)

2. **Double-click vs single-click toggle**: Design spec mentions both options. Recommendation:
   - Single-click: cycle through states (simpler, consistent)
   - Alternative: Single = expand/collapse, Double = hide (more discoverable)
