# Phase 4: GitHub Auth Handlers

**Parent:** [plan.md](./plan.md)
**Dependencies:** Phase 1
**Blocks:** Phase 5, Phase 6

---

## Overview

| Field | Value |
|-------|-------|
| Date | 2026-01-09 |
| Priority | P1 |
| Status | pending |
| Effort | 2h |

Implement missing GitHub IPC handlers in main process. Channels are defined but handlers not implemented.

---

## Requirements

- [ ] Implement GITHUB_AUTH_STATUS handler - check `gh auth status`
- [ ] Implement GITHUB_LOGIN handler - trigger `gh auth login --web`
- [ ] Implement GITHUB_CREATE_REPO handler - run `gh repo create`
- [ ] Add GitHub auth methods to preload/electron API
- [ ] Handle gh CLI not installed error gracefully

---

## Related Code

**File:** `src/shared/constants/ipc-channels.ts` (lines 57-63)
```typescript
GITHUB_AUTH_STATUS: 'github:auth-status',
GITHUB_LOGIN: 'github:login',
GITHUB_LOGOUT: 'github:logout',
GITHUB_CREATE_REPO: 'github:create-repo',
```

**File:** `src/main/ipc/handlers.ts` - GitHub handlers NOT implemented

**Type Reference:** `src/shared/types/index.ts` (lines 85-88)
```typescript
export interface GitHubAuth {
  isAuthenticated: boolean
  username?: string
}
```

---

## Implementation Steps

### 1. Create GitHub Auth Handlers File

**File:** `src/main/ipc/github-auth-handlers.ts`

```typescript
import { ipcMain } from 'electron'
import { exec, spawn } from 'child_process'
import { promisify } from 'util'
import { IPC_CHANNELS } from '@shared/constants'
import type { GitHubAuth } from '@shared/types'

const execPromise = promisify(exec)

export function registerGitHubHandlers() {
  // Check GitHub auth status
  ipcMain.handle(IPC_CHANNELS.GITHUB_AUTH_STATUS, async (): Promise<GitHubAuth> => {
    try {
      const { stdout } = await execPromise('gh auth status 2>&1')
      // Parse username from output: "Logged in to github.com as USERNAME"
      const match = stdout.match(/Logged in to github\.com as (\S+)/)
      return {
        isAuthenticated: true,
        username: match?.[1]
      }
    } catch {
      return { isAuthenticated: false }
    }
  })

  // Trigger GitHub login via browser
  ipcMain.handle(IPC_CHANNELS.GITHUB_LOGIN, async (): Promise<{ success: boolean; error?: string }> => {
    try {
      // Start gh auth login in background (opens browser)
      const child = spawn('gh', ['auth', 'login', '--web', '-h', 'github.com'], {
        detached: true,
        stdio: 'ignore'
      })
      child.unref()

      return { success: true }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to start login'
      }
    }
  })

  // Logout from GitHub
  ipcMain.handle(IPC_CHANNELS.GITHUB_LOGOUT, async (): Promise<{ success: boolean }> => {
    try {
      await execPromise('gh auth logout -h github.com')
      return { success: true }
    } catch {
      return { success: false }
    }
  })

  // Create GitHub repository
  ipcMain.handle(IPC_CHANNELS.GITHUB_CREATE_REPO, async (_, options: {
    name: string
    isPrivate: boolean
    cwd: string
  }): Promise<{ success: boolean; url?: string; error?: string }> => {
    try {
      const visibility = options.isPrivate ? '--private' : '--public'
      const cmd = `gh repo create "${options.name}" ${visibility} --source=. --push`

      const { stdout } = await execPromise(cmd, { cwd: options.cwd })

      // Extract URL from output
      const urlMatch = stdout.match(/https:\/\/github\.com\/[^\s]+/)
      return {
        success: true,
        url: urlMatch?.[0]
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Failed to create repository'

      // Check for common errors
      if (errorMsg.includes('already exists')) {
        return { success: false, error: 'Repository name already exists' }
      }
      if (errorMsg.includes('not found')) {
        return { success: false, error: 'gh CLI not installed' }
      }

      return { success: false, error: errorMsg }
    }
  })
}
```

### 2. Register Handlers in Main

**File:** `src/main/ipc/handlers.ts` or `src/main/index.ts`

```typescript
import { registerGitHubHandlers } from './ipc/github-auth-handlers'

// In initialization:
registerGitHubHandlers()
```

### 3. Add Types for Create Repo

**File:** `src/shared/types/index.ts`

```typescript
export interface GitHubCreateRepoOptions {
  name: string
  isPrivate: boolean
  cwd: string
}

export interface GitHubCreateRepoResult {
  success: boolean
  url?: string
  error?: string
}
```

### 4. Update Preload Script

**File:** `src/preload/index.ts`

Add to electron API:
```typescript
github: {
  getAuthStatus: (): Promise<GitHubAuth> =>
    ipcRenderer.invoke(IPC_CHANNELS.GITHUB_AUTH_STATUS),

  login: (): Promise<{ success: boolean; error?: string }> =>
    ipcRenderer.invoke(IPC_CHANNELS.GITHUB_LOGIN),

  logout: (): Promise<{ success: boolean }> =>
    ipcRenderer.invoke(IPC_CHANNELS.GITHUB_LOGOUT),

  createRepo: (options: GitHubCreateRepoOptions): Promise<GitHubCreateRepoResult> =>
    ipcRenderer.invoke(IPC_CHANNELS.GITHUB_CREATE_REPO, options)
}
```

### 5. Add Window Type Declaration

**File:** `src/preload/types.d.ts` or similar

```typescript
interface ElectronAPI {
  // ... existing

  github: {
    getAuthStatus: () => Promise<import('@shared/types').GitHubAuth>
    login: () => Promise<{ success: boolean; error?: string }>
    logout: () => Promise<{ success: boolean }>
    createRepo: (options: import('@shared/types').GitHubCreateRepoOptions) =>
      Promise<import('@shared/types').GitHubCreateRepoResult>
  }
}
```

---

## Todo List

- [ ] Create github-auth-handlers.ts
- [ ] Implement GITHUB_AUTH_STATUS handler
- [ ] Implement GITHUB_LOGIN handler
- [ ] Implement GITHUB_LOGOUT handler
- [ ] Implement GITHUB_CREATE_REPO handler
- [ ] Register handlers in main process
- [ ] Add types for options/results
- [ ] Update preload script
- [ ] Update window type declarations
- [ ] Test with gh CLI installed
- [ ] Test error handling (gh not installed)

---

## Success Criteria

- [ ] `getAuthStatus()` returns correct auth state
- [ ] `login()` opens browser for OAuth
- [ ] `createRepo()` creates repo and returns URL
- [ ] Errors are caught and returned gracefully
- [ ] Works on Windows, macOS, Linux

---

## Security Considerations

- Uses official `gh` CLI (trusted, no credential storage)
- No sensitive data in IPC responses (only username)
- Spawn detached for login (doesn't block app)

---

## Notes

- `gh auth login --web` opens browser, user completes flow there
- Polling for auth status recommended (renderer polls every 2s after login trigger)
- `--source=.` in repo create adds remote and pushes automatically
