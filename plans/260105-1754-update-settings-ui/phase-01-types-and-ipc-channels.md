# Phase 1: Types and IPC Channels

## Context

Foundation layer defining shared types and IPC channel constants used by both main and renderer processes.

## Overview

Create UpdateState type, add IPC channels, and define preload API interface for update operations.

## Requirements

- Define UpdateState interface with all update lifecycle states
- Add 6 IPC channels for update operations
- Extend ElectronAPI with update namespace

## Architecture

```
src/shared/
  types/
    update.ts        <- NEW: UpdateState, UpdateStatus
    index.ts         <- MODIFY: export * from './update'
  constants/
    ipc-channels.ts  <- MODIFY: add UPDATE_* channels

src/preload/
  index.ts           <- MODIFY: add update namespace to ElectronAPI
```

## Implementation Steps

### 1. Create `src/shared/types/update.ts`

```typescript
export type UpdateStatus = 'idle' | 'checking' | 'available' | 'downloading' | 'ready' | 'error'

export interface UpdateState {
  status: UpdateStatus
  currentVersion: string
  latestVersion: string | null
  releaseNotes: string | null
  downloadProgress: number // 0-100
  error: string | null
}
```

### 2. Modify `src/shared/types/index.ts`

Add at end:
```typescript
// Update types
export * from './update'
```

### 3. Modify `src/shared/constants/ipc-channels.ts`

Add after FILE_PICKER_OPEN:
```typescript
// Update channels
UPDATE_GET_STATE: 'update:get-state',
UPDATE_CHECK: 'update:check',
UPDATE_DOWNLOAD: 'update:download',
UPDATE_INSTALL: 'update:install',
UPDATE_GET_RELEASE_NOTES: 'update:get-release-notes',
UPDATE_STATUS_CHANGED: 'update:status-changed',
```

### 4. Modify `src/preload/index.ts`

Add import:
```typescript
import type { UpdateState } from '@shared/types'
```

Add to ElectronAPI interface (after filePicker):
```typescript
update: {
  getState: () => Promise<UpdateState>
  check: () => Promise<UpdateState>
  download: () => Promise<void>
  install: () => Promise<void>
  onStatusChanged: (callback: (state: UpdateState) => void) => () => void
}
```

Add to api object (after filePicker):
```typescript
update: {
  getState: () => ipcRenderer.invoke(IPC_CHANNELS.UPDATE_GET_STATE),
  check: () => ipcRenderer.invoke(IPC_CHANNELS.UPDATE_CHECK),
  download: () => ipcRenderer.invoke(IPC_CHANNELS.UPDATE_DOWNLOAD),
  install: () => ipcRenderer.invoke(IPC_CHANNELS.UPDATE_INSTALL),
  onStatusChanged: (callback) => {
    const listener = (_: unknown, state: UpdateState) => callback(state)
    ipcRenderer.on(IPC_CHANNELS.UPDATE_STATUS_CHANGED, listener)
    return () => ipcRenderer.removeListener(IPC_CHANNELS.UPDATE_STATUS_CHANGED, listener)
  }
}
```

## Todo

- [ ] Create `src/shared/types/update.ts` with UpdateState interface
- [ ] Add export to `src/shared/types/index.ts`
- [ ] Add UPDATE_* channels to `src/shared/constants/ipc-channels.ts`
- [ ] Add UpdateState import to `src/preload/index.ts`
- [ ] Add update namespace to ElectronAPI interface
- [ ] Add update implementation to api object
- [ ] Verify TypeScript compilation passes

## Success Criteria

- [ ] UpdateState type is exported from @shared/types
- [ ] IPC_CHANNELS includes all 6 UPDATE_* constants
- [ ] window.electron.update namespace available with correct typing
- [ ] No TypeScript errors
