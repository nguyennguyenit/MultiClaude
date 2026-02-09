# Phase 2: IPC & Preload Layer

## Overview

Add IPC channels and preload bindings for new Git operations.

**Status:** Pending
**Effort:** 1h
**Priority:** P1 (Depends on Phase 1)

## Context Links

- [Main Plan](./plan.md)
- [Phase 1](./phase-01-backend-git-manager.md)
- IPC channels: `src/shared/constants/ipc-channels.ts`
- Handlers: `src/main/ipc/handlers.ts`
- Preload: `src/preload/index.ts`

## Related Code Files

| Action | File | Description |
|--------|------|-------------|
| Modify | `src/shared/constants/ipc-channels.ts` | Add 7 new channels |
| Modify | `src/main/ipc/handlers.ts` | Register 7 new handlers |
| Modify | `src/preload/index.ts` | Expose 7 new methods |

## Implementation Steps

### Step 1: Add IPC Channels (src/shared/constants/ipc-channels.ts)

Add after line 25 (after GIT_PUSH):

```typescript
  // Git extended channels (commit workflow)
  GIT_FILE_STATUS: 'git:file-status',
  GIT_STAGE_FILE: 'git:stage-file',
  GIT_UNSTAGE_FILE: 'git:unstage-file',
  GIT_STAGE_ALL: 'git:stage-all',
  GIT_COMMIT: 'git:commit',
  GIT_DIFF: 'git:diff',
  GIT_DISCARD: 'git:discard',
```

### Step 2: Register IPC Handlers (src/main/ipc/handlers.ts)

Add after line 129 (after GIT_PUSH handler):

```typescript
  // Git extended handlers (commit workflow)
  ipcMain.handle(IPC_CHANNELS.GIT_FILE_STATUS, async (_, cwd: string) => {
    return gitManager.getFileStatus(cwd)
  })

  ipcMain.handle(IPC_CHANNELS.GIT_STAGE_FILE, async (_, { cwd, file }: { cwd: string; file: string }) => {
    return gitManager.stageFile(cwd, file)
  })

  ipcMain.handle(IPC_CHANNELS.GIT_UNSTAGE_FILE, async (_, { cwd, file }: { cwd: string; file: string }) => {
    return gitManager.unstageFile(cwd, file)
  })

  ipcMain.handle(IPC_CHANNELS.GIT_STAGE_ALL, async (_, cwd: string) => {
    return gitManager.stageAll(cwd)
  })

  ipcMain.handle(IPC_CHANNELS.GIT_COMMIT, async (_, { cwd, message }: { cwd: string; message: string }) => {
    return gitManager.commit(cwd, message)
  })

  ipcMain.handle(IPC_CHANNELS.GIT_DIFF, async (_, { cwd, file, staged }: { cwd: string; file?: string; staged?: boolean }) => {
    return gitManager.getDiff(cwd, file, staged)
  })

  ipcMain.handle(IPC_CHANNELS.GIT_DISCARD, async (_, { cwd, file }: { cwd: string; file: string }) => {
    return gitManager.discardChanges(cwd, file)
  })
```

### Step 3: Update Preload API (src/preload/index.ts)

#### 3a. Update imports (line 3)

```typescript
import type { Terminal, Project, GitStatus, GitHubAuth, GitFileStatus, GitCommitResult, GitDiffResult, AppSession, NotificationSettings, NotificationEvent, NotificationTestResult } from '@shared/types'
```

#### 3b. Extend git interface in ElectronAPI (after line 30)

```typescript
  git: {
    status: (cwd: string) => Promise<GitStatus>
    init: (cwd: string) => Promise<boolean>
    addRemote: (cwd: string, url: string, name?: string) => Promise<boolean>
    push: (cwd: string, branch?: string, setUpstream?: boolean) => Promise<boolean>
    // New commit workflow methods
    fileStatus: (cwd: string) => Promise<GitFileStatus[]>
    stageFile: (cwd: string, file: string) => Promise<boolean>
    unstageFile: (cwd: string, file: string) => Promise<boolean>
    stageAll: (cwd: string) => Promise<boolean>
    commit: (cwd: string, message: string) => Promise<GitCommitResult>
    diff: (cwd: string, file?: string, staged?: boolean) => Promise<GitDiffResult>
    discard: (cwd: string, file: string) => Promise<boolean>
  }
```

#### 3c. Add implementations (after line 109)

```typescript
  git: {
    status: (cwd) => ipcRenderer.invoke(IPC_CHANNELS.GIT_STATUS, cwd),
    init: (cwd) => ipcRenderer.invoke(IPC_CHANNELS.GIT_INIT, cwd),
    addRemote: (cwd, url, name) => ipcRenderer.invoke(IPC_CHANNELS.GIT_ADD_REMOTE, { cwd, url, name }),
    push: (cwd, branch, setUpstream) => ipcRenderer.invoke(IPC_CHANNELS.GIT_PUSH, { cwd, branch, setUpstream }),
    // New commit workflow methods
    fileStatus: (cwd) => ipcRenderer.invoke(IPC_CHANNELS.GIT_FILE_STATUS, cwd),
    stageFile: (cwd, file) => ipcRenderer.invoke(IPC_CHANNELS.GIT_STAGE_FILE, { cwd, file }),
    unstageFile: (cwd, file) => ipcRenderer.invoke(IPC_CHANNELS.GIT_UNSTAGE_FILE, { cwd, file }),
    stageAll: (cwd) => ipcRenderer.invoke(IPC_CHANNELS.GIT_STAGE_ALL, cwd),
    commit: (cwd, message) => ipcRenderer.invoke(IPC_CHANNELS.GIT_COMMIT, { cwd, message }),
    diff: (cwd, file, staged) => ipcRenderer.invoke(IPC_CHANNELS.GIT_DIFF, { cwd, file, staged }),
    discard: (cwd, file) => ipcRenderer.invoke(IPC_CHANNELS.GIT_DISCARD, { cwd, file })
  },
```

## Todo List

- [ ] Add 7 IPC channel constants
- [ ] Register 7 IPC handlers in handlers.ts
- [ ] Update ElectronAPI interface with 7 new git methods
- [ ] Implement 7 preload method bindings
- [ ] Verify TypeScript compiles without errors

## Success Criteria

- `window.electron.git.fileStatus()` accessible from renderer
- All 7 new methods callable from React components
- TypeScript types match across layers

## Next Steps

→ Phase 3: Frontend Git Panel Components
