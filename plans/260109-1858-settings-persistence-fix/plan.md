---
title: "Windows Settings Persistence Fix"
description: "Migrate settings from localStorage to electron-store with explicit Save/Cancel flow"
status: completed
priority: P1
effort: 3h
branch: master
tags: [bugfix, backend, settings, electron, ux]
created: 2026-01-09
---

# Windows Settings Persistence Fix

## Overview

Settings (Theme, Shell preferences) don't persist after app restart on Windows. Root cause: using `localStorage` (browser storage) instead of `electron-store` (disk file persistence).

**Solution:**
1. Migrate settings from localStorage to electron-store via IPC
2. Implement explicit Save/Cancel flow (preview changes, save only on button click)

## UX Flow (New)

```
Open Settings → Load saved settings as preview
Change Theme → Preview applied immediately (not saved yet)
Click Cancel/X → Revert to saved settings
Click Save → Persist to disk, close modal
```

## Phases

| # | Phase | Status | Effort | Link |
|---|-------|--------|--------|------|
| 1 | Main Process Settings Store | DONE (2026-01-09 20:52) | 1h | [phase-01](./phase-01-main-settings-store.md) |
| 2 | IPC + Preload Layer | DONE (2026-01-09 21:37) | 45m | [phase-02-ipc-preload-layer.md](./phase-02-ipc-preload-layer.md) |
| 3 | Renderer Store Migration | DONE (2026-01-09) | 1h | [phase-03-renderer-migration.md](./phase-03-renderer-migration.md) |
| 4 | Testing + Validation | DONE (2026-01-09 23:37) | 15m | [phase-04-testing-validation.md](./phase-04-testing-validation.md) |

## Key Changes

| Component | Before | After |
|-----------|--------|-------|
| Storage | localStorage (broken) | electron-store (reliable) |
| Save behavior | Auto-save on change | Explicit Save button |
| Cancel behavior | None (changes already saved) | Revert to last saved |
| State | Single `settings` | `savedSettings` + `pendingSettings` |

## Dependencies

- electron-store (already installed)
- Existing `ProjectStore` pattern at `src/main/project/project-store.ts`
- Existing `AppSettings` type at `src/shared/types/index.ts`

## References

- Brainstorm: `plans/reports/brainstorm-260109-1830-settings-save-windows-bug.md`
- Pattern to follow: `src/main/project/project-store.ts`
- Current broken store: `src/renderer/stores/settings-store.ts`
