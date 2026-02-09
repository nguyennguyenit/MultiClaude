---
title: "Glassmorphism Full App Redesign"
description: "Implement glassmorphism + modern soft hybrid design across MultiClaude UI"
status: pending
priority: P2
effort: 6h
branch: beta
tags: [ui, design, glassmorphism, theming]
created: 2026-01-07
---

# Glassmorphism Full App Redesign

## Overview

Implement hybrid design system: Modern Soft base + Glassmorphism enhancement when `glassmorphismEnabled: true`.

## Design Principles

- **Base:** Solid backgrounds, rounded corners, subtle shadows
- **Enhanced:** Semi-transparent panels, backdrop blur, glowing borders
- **Terminal:** High opacity (90%+), minimal/no blur for readability
- **Chrome:** Full glassmorphism (70-80% opacity, 12-16px blur)

## Phases

| Phase | Focus | Effort | Files |
|-------|-------|--------|-------|
| [Phase 1](./phase-01-core-infrastructure.md) | CSS tokens, utility classes, toggle UI | 1h | globals.css, theme-selector.tsx |
| [Phase 2](./phase-02-navigation-chrome.md) | Sidebar, TitleBar glassmorphism | 1.5h | sidebar.tsx, sidebar-header.tsx |
| [Phase 3](./phase-03-content-area.md) | Terminal panels, tabs, resize handles | 1.5h | terminal-grid.tsx, project-tabs.tsx |
| [Phase 4](./phase-04-overlays-modals.md) | Settings modal, dialogs, toasts | 1h | settings-modal.tsx, toast-container.tsx |
| [Phase 5](./phase-05-form-controls.md) | Buttons, inputs, toggles, focus states | 1h | theme-selector.tsx, UI components |

## Key Design Tokens

```css
--mc-glass-blur: 12px;
--mc-glass-bg: rgba(255,255,255,0.05);   /* dark */
--mc-glass-border: rgba(255,255,255,0.1);
--mc-glass-shadow: 0 8px 32px rgba(0,0,0,0.2);
--mc-radius-sm/md/lg/xl: 6px/12px/16px/24px;
```

## Success Criteria

1. Smooth toggle between enabled/disabled states
2. No performance regression (blur only on chrome, not terminal)
3. WCAG AA contrast maintained
4. Works with all 10 existing color themes

## Dependencies

- `glassmorphismEnabled: boolean` in AppSettings (exists)
- CSS custom properties system (exists in globals.css)
- Zustand settings store with `setGlassmorphismEnabled` (exists)

## Research

- [CSS Patterns](./research/researcher-01-glassmorphism-css.md)
- [Terminal UI Patterns](./research/researcher-02-terminal-ui-patterns.md)

## Validation Summary

**Validated:** 2026-01-07
**Questions asked:** 4

### Confirmed Decisions

| Decision | User Choice |
|----------|-------------|
| Terminal blur | **No blur** - solid 95%+ opacity for text readability |
| Light/dark mode | **Same approach** - identical glass tokens, adjusted opacity |
| Toggle transition | **Smooth 200-300ms** fade between states |
| Reduced transparency | **Silent fallback** - auto-use solid backgrounds |

### Implications for Implementation

1. Phase 3: Remove any blur considerations from terminal panels - use solid `rgba(30,30,30,0.95)` bg
2. Phase 1: Light mode gets same glass tokens, no separate reduced set
3. Phase 1-2: Add CSS transitions (200ms ease) on background/backdrop-filter changes
4. Phase 1: `@media (prefers-reduced-transparency)` uses solid bg without notification
