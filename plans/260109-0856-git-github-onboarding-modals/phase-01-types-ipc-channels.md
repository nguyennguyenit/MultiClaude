# Phase 1: Types & IPC Channels

**Parent:** [plan.md](./plan.md)
**Dependencies:** None
**Blocks:** Phase 2, 3, 4, 5, 6

---

## Overview

| Field | Value |
|-------|-------|
| Date | 2026-01-09 |
| Priority | P1 |
| Status | pending |
| Effort | 1h |

Extend Project interface with dismissal flags and verify existing IPC channels are sufficient for both modals.

---

## Requirements

- [ ] Add `gitInitPromptDismissed?: boolean` to Project interface
- [ ] Add `githubConnectionPromptDismissed?: boolean` to Project interface
- [ ] Verify `PROJECT_CHECK_FOLDER` returns `isGitRepo` (already does)
- [ ] Verify `GIT_INIT` handler exists (already does)
- [ ] Verify GitHub IPC channels defined (GITHUB_AUTH_STATUS, LOGIN, CREATE_REPO)

---

## Related Code

**File:** `src/shared/types/index.ts` (lines 25-32)
```typescript
export interface Project {
  id: string
  name: string
  path: string
  gitRemote?: string
  createdAt: Date
  updatedAt: Date
}
```

**File:** `src/shared/constants/ipc-channels.ts` (lines 57-63)
```typescript
// GitHub channels
GITHUB_AUTH_STATUS: 'github:auth-status',
GITHUB_LOGIN: 'github:login',
GITHUB_LOGOUT: 'github:logout',
GITHUB_CREATE_REPO: 'github:create-repo',
```

**File:** `src/main/ipc/handlers.ts` (lines 125-146, 167-169)
- `PROJECT_CHECK_FOLDER` - returns `{ exists, isEmpty, isGitRepo, fileCount }`
- `GIT_INIT` - calls `gitManager.init(cwd)`

---

## Implementation Steps

### 1. Extend Project Interface

**File:** `src/shared/types/index.ts`

```typescript
export interface Project {
  id: string
  name: string
  path: string
  gitRemote?: string
  createdAt: Date
  updatedAt: Date
  // NEW: Track prompt dismissals
  gitInitPromptDismissed?: boolean
  githubConnectionPromptDismissed?: boolean
}
```

### 2. Update Project Store (if needed)

**File:** `src/main/project/project-store.ts`

Verify the store serializes/deserializes new optional fields. If using electron-store, optional fields should work automatically.

### 3. Verify IPC Response Type

**File:** `src/shared/types/index.ts` or inline in handlers

Add type for check folder response if not exists:
```typescript
export interface FolderCheckResult {
  exists: boolean
  isEmpty: boolean
  isGitRepo: boolean
  fileCount: number
}
```

### 4. Verify Electron Preload Exposes Methods

**File:** `src/preload/index.ts`

Check these methods are exposed:
- `window.electron.project.checkFolder(path)` - should return FolderCheckResult
- `window.electron.git.init(path)` - should return boolean
- `window.electron.github.getAuthStatus()` - CRITICAL: may not be implemented

---

## Todo List

- [ ] Extend Project interface with dismissal flags
- [ ] Add FolderCheckResult type if missing
- [ ] Verify project-store handles new fields
- [ ] Check preload exposes required methods
- [ ] Document any missing handlers (for Phase 4)

---

## Success Criteria

- [ ] TypeScript compiles with new Project fields
- [ ] Existing project CRUD operations still work
- [ ] `checkFolder` returns correct `isGitRepo` status
- [ ] No regression in project list/creation

---

## Notes

- No new IPC channels needed for Git Init Modal
- GitHub handlers likely missing implementation (flagged for Phase 4)
- Keep types minimal - avoid over-engineering
