# Phase 2: IPC + Preload Layer

## Context Links
- Parent plan: [plan.md](./plan.md)
- Previous: [phase-01](./phase-01-main-settings-store.md)
- IPC channels: `src/shared/constants/ipc-channels.ts`
- Preload: `src/preload/index.ts`
- Handlers: `src/main/ipc/handlers.ts`

## Overview
- **Priority:** P1
- **Status:** DONE (2026-01-09 21:37)
- **Description:** Add IPC handlers and preload API for settings CRUD operations

## Key Insights
- Follow existing patterns (notification, update namespaces)
- Use `invoke` for async request/response
- Expose typed API via `window.electron.settings`

## Requirements
- [x] Add IPC channels for settings:get and settings:set
- [x] Register handlers in main process
- [x] Expose API in preload script
- [x] Type-safe interface in ElectronAPI

## Architecture

```
Renderer                    Preload                     Main
   |                          |                          |
   |--settings.get()--------->|                          |
   |                          |--ipc.invoke()----------->|
   |                          |                          |--SettingsStore.getSettings()
   |                          |<---------AppSettings-----|
   |<--------AppSettings------|                          |
```

## Related Code Files

| Action | Path | Description |
|--------|------|-------------|
| MODIFY | `src/shared/constants/ipc-channels.ts` | Add SETTINGS_GET, SETTINGS_SET channels |
| MODIFY | `src/main/ipc/handlers.ts` | Add settings IPC handlers |
| MODIFY | `src/preload/index.ts` | Expose settings API |

## Implementation Steps

### Step 1: Add IPC Channels
Add to `src/shared/constants/ipc-channels.ts`:
```typescript
// Settings channels
SETTINGS_GET: 'settings:get',
SETTINGS_SET: 'settings:set',
```

### Step 2: Add IPC Handlers
Add to `src/main/ipc/handlers.ts`:

```typescript
import { SettingsStore } from '../settings'
import type { AppSettings } from '@shared/types'

// Instantiate (or receive from main index)
const settingsStore = new SettingsStore()

// Handler registration
ipcMain.handle(IPC_CHANNELS.SETTINGS_GET, () => {
  return settingsStore.getSettings()
})

ipcMain.handle(IPC_CHANNELS.SETTINGS_SET, (_, settings: Partial<AppSettings>) => {
  return settingsStore.setSettings(settings)
})
```

### Step 3: Update Preload Script
Add to `src/preload/index.ts`:

**Type definition:**
```typescript
settings: {
  get: () => Promise<AppSettings>
  set: (settings: Partial<AppSettings>) => Promise<AppSettings>
}
```

**Implementation:**
```typescript
settings: {
  get: () => ipcRenderer.invoke(IPC_CHANNELS.SETTINGS_GET),
  set: (settings) => ipcRenderer.invoke(IPC_CHANNELS.SETTINGS_SET, settings)
}
```

## Todo List
- [x] Add `SETTINGS_GET` and `SETTINGS_SET` to IPC channels
- [x] Register handlers in `handlers.ts`
- [x] Add `settings` namespace to ElectronAPI interface
- [x] Implement preload bridge methods

## Success Criteria
- [x] `window.electron.settings.get()` returns AppSettings
- [x] `window.electron.settings.set({...})` persists and returns updated settings
- [x] No TypeScript errors

## Risk Assessment
| Risk | Impact | Mitigation |
|------|--------|------------|
| IPC latency | Low | Negligible for settings ops |
| Handler registration order | Low | Register after app ready |

## Security Considerations
- IPC channels are internal only (no external access)
- No untrusted data paths

## Next Steps
Proceed to Phase 3: Renderer Store Migration
