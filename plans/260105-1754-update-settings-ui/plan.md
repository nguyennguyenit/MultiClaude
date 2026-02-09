---
title: "In-App Update Settings UI"
description: "Add Updates tab to Settings with version info, check button, changelog, and progress bar"
status: completed
priority: P2
effort: 4h
branch: master
tags: [electron, updates, settings, ui]
created: 2026-01-05
completed: 2026-01-05
---

# In-App Update Settings UI

## Overview

Replace native OS dialogs with in-app UI for update management. Users see current version, check for updates, view changelog from GitHub Releases, and monitor download progress via a new "Updates" tab in Settings.

## Architecture

```
Main Process                    Renderer
-------------                   --------
auto-updater.ts                 update-store.ts
  - state management              - Zustand store
  - GitHub API fetch              - IPC listeners
  - IPC events            <-->    - actions

handlers.ts                     update-settings.tsx
  - UPDATE_* handlers              - UI component

                                sidebar.tsx
                                  - badge dot
```

## Phases

| # | Phase | Status | Effort | File |
|---|-------|--------|--------|------|
| 1 | Types + IPC Channels | completed | 30m | [phase-01-types-and-ipc-channels.md](./phase-01-types-and-ipc-channels.md) |
| 2 | Main Process Enhancements | completed | 1.5h | [phase-02-main-process-enhancements.md](./phase-02-main-process-enhancements.md) |
| 3 | Renderer Store + UI | completed | 2h | [phase-03-renderer-store-and-ui.md](./phase-03-renderer-store-and-ui.md) |

## Dependencies

- electron-updater (existing)
- GitHub Releases API (public, no auth)
- Zustand (existing)

## Files Modified

| File | Action |
|------|--------|
| `src/shared/types/update.ts` | Create |
| `src/shared/types/index.ts` | Modify - add export |
| `src/shared/constants/ipc-channels.ts` | Modify - add UPDATE_* |
| `src/main/updater/auto-updater.ts` | Modify - state + IPC |
| `src/main/ipc/handlers.ts` | Modify - add handlers |
| `src/preload/index.ts` | Modify - add update namespace |
| `src/renderer/stores/update-store.ts` | Create |
| `src/renderer/components/settings/update-settings.tsx` | Create |
| `src/renderer/components/settings/settings-panel.tsx` | Modify - add tab |
| `src/renderer/components/sidebar/sidebar.tsx` | Modify - add badge |

## Success Criteria

- [x] Current version displays in Updates tab
- [x] "Check for Updates" triggers check, shows result
- [x] Changelog displays (plain text, not markdown)
- [x] Download progress bar shows 0-100%
- [x] "Install and Restart" works
- [x] Badge dot on Settings button when update available
- [x] No regression in existing auto-update behavior

## Validation Summary

**Validated:** 2026-01-05
**Questions asked:** 7

### Confirmed Decisions

| Decision | User Choice |
|----------|-------------|
| Changelog display | Plain text (raw markdown) |
| Badge visibility | Show for 'available' and 'ready' states |
| Auto-check behavior | Check on startup (3s delay) |
| Error handling | Silent graceful degradation |
| Install action | Immediate restart |
| Cache TTL | **24 hours** (changed from 1hr) |
| Dev mode behavior | Mock disabled state |

### Action Items

- [x] Update Phase 2: Change `CACHE_TTL` from 1hr to 24hr in `auto-updater.ts`

### Notes

All recommended options were confirmed. Single change required: cache TTL increased to 24 hours to minimize GitHub API calls (release notes rarely change).
