---
title: "Notifications Settings Feature"
description: "Add notification system with app, Telegram, Discord integrations and sound presets"
status: done
priority: P2
effort: 6h
branch: master
tags: [feature, settings, notifications, electron]
created: 2025-12-31
completed: 2026-01-01
---

# Notifications Settings Feature

## Overview

Add Notifications section to Settings menu with:
- 3 event types: Task Complete, Task Failed, Review Needed
- Sound notifications with multiple presets
- External notifications via Telegram and Discord (both simultaneously)
- Toggle switches for each option
- Modal popups for platform configuration

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        RENDERER PROCESS                          │
├─────────────────────────────────────────────────────────────────┤
│  SettingsPanel                                                   │
│  └── NotificationSettings (new)                                  │
│      ├── Event Toggles                                           │
│      ├── Sound Settings                                          │
│      └── External Config (Telegram/Discord modals)               │
├─────────────────────────────────────────────────────────────────┤
│  notification-store.ts (Zustand)                                 │
└─────────────────────────────────────────────────────────────────┘
                              │ IPC
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                         MAIN PROCESS                             │
├─────────────────────────────────────────────────────────────────┤
│  notification/                                                   │
│  ├── notification-manager.ts  (orchestration)                    │
│  ├── pattern-detector.ts      (terminal output parsing)          │
│  ├── telegram-notifier.ts     (Bot API)                          │
│  ├── discord-notifier.ts      (Webhook)                          │
│  └── secure-storage.ts        (safeStorage wrapper)              │
├─────────────────────────────────────────────────────────────────┤
│  Electron safeStorage → encrypt credentials                      │
└─────────────────────────────────────────────────────────────────┘
```

## Phases

| # | Phase | Status | Effort | Link |
|---|-------|--------|--------|------|
| 1 | Types & Constants | Done (2026-01-01) | 1h | [phase-01](./phase-01-types-constants.md) |
| 2 | Main Process (notification module) | Done (2026-01-01) | 2.5h | [phase-02](./phase-02-main-process.md) |
| 3 | Renderer (UI components + store) | Done (2026-01-01) | 2.5h | [phase-03](./phase-03-renderer.md) |

## Key Decisions

1. **Secure Storage**: Electron `safeStorage` (built-in) instead of keytar
2. **External APIs**: Direct fetch (no npm dependencies)
3. **Sound**: HTML5 Audio with bundled preset files
4. **Pattern Detection**: Regex-based with configurable patterns (placeholder initially)

## Dependencies

- No new npm packages required
- Need sound files (mp3): success, error, info for each preset

## Files to Create

```
src/
├── main/notification/
│   ├── index.ts
│   ├── notification-manager.ts
│   ├── pattern-detector.ts
│   ├── telegram-notifier.ts
│   ├── discord-notifier.ts
│   └── secure-storage.ts
├── renderer/
│   ├── components/settings/
│   │   ├── notification-settings.tsx
│   │   ├── telegram-config-modal.tsx
│   │   └── discord-config-modal.tsx
│   ├── stores/notification-store.ts
│   └── assets/sounds/ (mp3 files)
└── shared/types/notification.ts
```

## Files to Modify

- `src/shared/types/index.ts` - export notification types
- `src/shared/constants/ipc-channels.ts` - add notification channels
- `src/shared/constants/index.ts` - export notification constants
- `src/preload/index.ts` - expose notification API
- `src/main/ipc/handlers.ts` - register notification handlers
- `src/main/index.ts` - init notification manager
- `src/renderer/components/settings/settings-panel.tsx` - add NotificationSettings
- `src/renderer/stores/index.ts` - export notification store

## Risks

| Risk | Mitigation |
|------|------------|
| Unknown Claude Code output patterns | Start with placeholder patterns; log output for research |
| Rate limiting (Telegram/Discord) | Debounce notifications (300ms) |
| safeStorage unavailable on Linux | Fallback to electron-store encryption |

## References

- [Brainstorm Report](../reports/brainstorm-251231-1943-notifications-settings-feature.md)
- [Electron safeStorage](https://www.electronjs.org/docs/latest/api/safe-storage)
