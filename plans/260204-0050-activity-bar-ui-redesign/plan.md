---
title: "Activity Bar UI Redesign"
description: "VS Code-style activity bar replacing current sidebar with titlebar integration"
status: pending
priority: P1
effort: 6h
branch: beta
tags: [ui, refactor, activity-bar, titlebar]
created: 2026-02-04
---

# Activity Bar UI Redesign

## Overview

Replace current sidebar with VS Code-style vertical Activity Bar. Integrate project tabs and logo into titlebar. Support 3 states: collapsed (default), expanded, hidden.

## Current Architecture

```
+------------------+-----------------------------------+
| [☰] Title        | MultiClaude (centered)            |  <- Titlebar (h-10)
+------------------+-----------------------------------+
| [1]Tab [2]Tab... | [+]                               |  <- ProjectTabs (h-9)
+------------------+-----------------------------------+
| Logo+MultiClaude |                                   |
| ─────────────────|                                   |
| Navigation       |                                   |
|  • Terminals     |        Content Area               |
|  • GitHub        |                                   |
| [spacer]         |                                   |
| UserAccountCard  |                                   |
| ─────────────────|                                   |
| ⚙ Settings       |                                   |
+------------------+-----------------------------------+
     240px/60px              flex-1
```

## Target Architecture

```
+--------+---------------------------------------------------+
| Logo+? | [1]Tab [2]Tab... [+]      MultiClaude (if room)   |  <- Titlebar (h-10)
+--------+---------------------------------------------------+
| 📺(3)  |                                                   |
| 🐙(2)  |                                                   |
|        |                                                   |
|        |                Content Area                       |
|        |                                                   |
|        |                                                   |
| 👤     |                                                   |
| ⚙      |                                                   |
| [><]   |                                                   |
+--------+---------------------------------------------------+
  48px              flex-1

States:
- Collapsed (48px): Icons only, badges, tooltips on hover
- Expanded (200px): Icons + labels + UserAccountCard
- Hidden (0px): Show via hover left edge or Ctrl+B
```

## Phases

| Phase | Description | Status | Effort |
|-------|-------------|--------|--------|
| 1 | [Titlebar Integration](./phase-01-titlebar-integration.md) | pending | 1.5h |
| 2 | [Activity Bar Component](./phase-02-activity-bar-component-replacing-sidebar.md) | pending | 2h |
| 3 | [State Management](./phase-03-state-management-for-activity-bar-toggle.md) | pending | 1h |
| 4 | [CSS & Animation](./phase-04-css-variables-and-transition-animations.md) | pending | 1h |
| 5 | [Cleanup & Polish](./phase-05-cleanup-old-sidebar-and-final-polish.md) | pending | 0.5h |

## Key Files to Modify

| File | Changes |
|------|---------|
| `src/renderer/App.tsx` | New layout structure, titlebar redesign |
| `src/renderer/components/sidebar/sidebar.tsx` | Rename to activity-bar.tsx, complete rewrite |
| `src/renderer/components/project-tabs/project-tabs.tsx` | Remove container wrapper, integrate into titlebar |
| `src/renderer/stores/app-store.ts` | Add activityBarState: 'collapsed' \| 'expanded' \| 'hidden' |
| `src/renderer/styles/globals.css` | Update CSS variables for activity bar widths |

## Files to Delete

- `src/renderer/components/sidebar/sidebar-header.tsx` - Logo moves to titlebar
- `src/renderer/components/sidebar/navigation-item.tsx` - Replaced by activity bar icons

## Success Criteria

- [ ] Logo in titlebar, responsive (icon only when activity bar collapsed/hidden)
- [ ] Project tabs integrated into titlebar after logo
- [ ] Activity bar with 3 states (collapsed default, expanded, hidden)
- [ ] Badges show counts (terminal count, changes count)
- [ ] Hover on left edge reveals hidden activity bar
- [ ] Ctrl+B toggles between states
- [ ] No visual regression in terminal/GitHub views
- [ ] macOS traffic lights still work correctly

## Dependencies

- None (self-contained UI refactor)

## Risk Assessment

| Risk | Mitigation |
|------|------------|
| xterm state loss on layout change | Maintain same CSS visibility pattern |
| macOS traffic light positioning | Test with ml-16 padding when activity bar hidden |
| State persistence | Store activityBarState in settings-store for persistence |
