---
title: "UI Redesign Phase 4: Settings Modal"
description: "Convert inline settings panel to modal popup with 3 tabs"
status: completed
priority: P1
effort: 4h
branch: master
tags: [frontend, ui, settings, modal, redesign]
created: 2026-01-04
---

# UI Redesign Phase 4: Settings Modal

## Overview

Convert the current inline SettingsPanel in sidebar to a modal popup dialog with improved layout matching design spec.

## Design Reference

- Spec: `plans/UX-UI/MultiClaude-UI-UX-Design.md` (lines 345-592)
- Previous: Phases 1-3 of UI Redesign

## Phases

| # | Phase | Status | Effort | Link |
|---|-------|--------|--------|------|
| 1 | Modal Container | Pending | 1h | [phase-01](./phase-01-modal-container.md) |
| 2 | Appearance Tab | Pending | 1h | [phase-02](./phase-02-appearance-tab.md) |
| 3 | Terminals Tab | Pending | 1h | [phase-03](./phase-03-terminals-tab.md) |
| 4 | Integration | Pending | 1h | [phase-04](./phase-04-integration.md) |

## Key Components

### Design Layout
```
┌─────────────────────────────────────────────────────────────────┐
│  Settings                                                  ✕    │
│  App Settings                                                   │
├────────────────────────┬────────────────────────────────────────┤
│  Appearance        ◀   │                                        │
│  Terminals             │         (Content Area)                 │
│  Notifications         │                                        │
├────────────────────────┴────────────────────────────────────────┤
│                                     [ Cancel ]  [ Save Settings ]│
└─────────────────────────────────────────────────────────────────┘
```

## Reusable Components

| Component | File | Strategy |
|-----------|------|----------|
| ThemeSelector | theme-selector.tsx | Refactor for new layout |
| TerminalSettings | terminal-settings.tsx | Refactor for new layout |
| NotificationSettings | notification-settings.tsx | Refactor for new layout |
| TelegramConfigModal | telegram-config-modal.tsx | Direct reuse |
| DiscordConfigModal | discord-config-modal.tsx | Direct reuse |

## Files Summary

### Create
- `src/renderer/components/settings/settings-modal.tsx`
- `src/renderer/components/settings/settings-sidebar.tsx`

### Modify
- `src/renderer/components/settings/theme-selector.tsx` - Adapt layout
- `src/renderer/components/settings/terminal-settings.tsx` - Adapt layout
- `src/renderer/components/settings/notification-settings.tsx` - Adapt layout
- `src/renderer/stores/settings-store.ts` - Add modal state
- `src/renderer/App.tsx` - Add modal trigger

### Delete (after integration)
- Remove inline SettingsPanel usage from sidebar

## Dependencies

- Existing: settings-store.ts, notification-store.ts
- Existing: All tab components (ThemeSelector, TerminalSettings, NotificationSettings)
