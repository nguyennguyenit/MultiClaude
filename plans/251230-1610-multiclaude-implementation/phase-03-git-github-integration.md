---
title: "Phase 3: Git + GitHub Integration"
status: pending
priority: P2
effort: 6h
---

# Phase 3: Git + GitHub Integration

> Context: [plan.md](./plan.md) | [Phase 2](./phase-02-terminal-management.md)

## Overview
| Field | Value |
|-------|-------|
| Date | 2025-12-30 |
| Priority | P2 - Important |
| Status | Pending |
| Effort | 6h |

## Objective
Enable Git repository initialization and GitHub connection from the app UI.

## Requirements
- R1: Initialize git repository in project directory
- R2: Show git status (branch, changes count)
- R3: Authenticate with GitHub via `gh` CLI
- R4: Create GitHub repository and push
- R5: Display GitHub connection status

## Architecture

### Design Decision: Use `gh` CLI
Instead of implementing OAuth flow manually, delegate to `gh auth login`. Benefits:
- Proven auth flow
- Handles token storage securely
- Simpler implementation (KISS)

### Git Manager (Main Process)
```typescript
interface GitStatus {
  initialized: boolean
  branch: string | null
  ahead: number
  behind: number
  staged: number
  modified: number
  untracked: number
}

interface GitManager {
  init(path: string): Promise<void>
  getStatus(path: string): Promise<GitStatus>
  isGitHubConnected(): Promise<boolean>
  createGitHubRepo(name: string, isPrivate: boolean): Promise<string>
  pushToGitHub(path: string): Promise<void>
}
```

### IPC Channels
| Channel | Direction | Payload |
|---------|-----------|---------|
| `git:init` | renderer→main | `{ path }` |
| `git:status` | renderer→main | `{ path }` → `GitStatus` |
| `git:github-auth` | renderer→main | `{}` → `{ authenticated }` |
| `git:create-repo` | renderer→main | `{ name, private }` → `{ url }` |
| `git:push` | renderer→main | `{ path }` |

## Implementation Steps

### Step 1: Install Dependencies (15m)
```bash
npm i simple-git
```

### Step 2: Create Git Manager (2h)
`src/main/git/git-manager.ts`:
```typescript
import simpleGit, { SimpleGit } from 'simple-git'
import { exec } from 'child_process'
import { promisify } from 'util'

const execAsync = promisify(exec)

export interface GitStatus {
  initialized: boolean
  branch: string | null
  ahead: number
  behind: number
  staged: number
  modified: number
  untracked: number
}

export class GitManager {
  private getGit(path: string): SimpleGit {
    return simpleGit(path)
  }

  async init(path: string): Promise<void> {
    const git = this.getGit(path)
    await git.init()
  }

  async getStatus(path: string): Promise<GitStatus> {
    const git = this.getGit(path)

    try {
      const status = await git.status()
      return {
        initialized: true,
        branch: status.current,
        ahead: status.ahead,
        behind: status.behind,
        staged: status.staged.length,
        modified: status.modified.length,
        untracked: status.not_added.length
      }
    } catch {
      return {
        initialized: false,
        branch: null,
        ahead: 0,
        behind: 0,
        staged: 0,
        modified: 0,
        untracked: 0
      }
    }
  }

  async isGitHubAuthenticated(): Promise<boolean> {
    try {
      await execAsync('gh auth status')
      return true
    } catch {
      return false
    }
  }

  async authenticateGitHub(): Promise<void> {
    // Opens browser for OAuth
    await execAsync('gh auth login --web')
  }

  async createGitHubRepo(
    path: string,
    name: string,
    isPrivate: boolean
  ): Promise<string> {
    const visibility = isPrivate ? '--private' : '--public'
    const { stdout } = await execAsync(
      `gh repo create ${name} ${visibility} --source=${path} --remote=origin --push`,
      { cwd: path }
    )

    // Extract URL from output
    const urlMatch = stdout.match(/https:\/\/github\.com\/[^\s]+/)
    return urlMatch?.[0] || `https://github.com/${name}`
  }

  async push(path: string): Promise<void> {
    const git = this.getGit(path)
    await git.push('origin', 'main')
  }
}

export const gitManager = new GitManager()
```

### Step 3: Create IPC Handlers (1h)
`src/main/ipc/git-handlers.ts`:
```typescript
import { ipcMain, shell } from 'electron'
import { gitManager } from '../git/git-manager'

export function registerGitHandlers() {
  ipcMain.handle('git:init', async (_, { path }) => {
    await gitManager.init(path)
    return { success: true }
  })

  ipcMain.handle('git:status', async (_, { path }) => {
    return gitManager.getStatus(path)
  })

  ipcMain.handle('git:github-auth-status', async () => {
    return { authenticated: await gitManager.isGitHubAuthenticated() }
  })

  ipcMain.handle('git:github-login', async () => {
    // Open terminal for gh auth (interactive)
    // This opens default browser for OAuth
    try {
      await gitManager.authenticateGitHub()
      return { success: true }
    } catch (error) {
      return { success: false, error: String(error) }
    }
  })

  ipcMain.handle('git:create-repo', async (_, { path, name, isPrivate }) => {
    const url = await gitManager.createGitHubRepo(path, name, isPrivate)
    return { url }
  })

  ipcMain.handle('git:push', async (_, { path }) => {
    await gitManager.push(path)
    return { success: true }
  })
}
```

### Step 4: Update Preload (30m)
Add git APIs to `src/preload/index.ts`:
```typescript
git: {
  init: (path: string) =>
    ipcRenderer.invoke('git:init', { path }),
  getStatus: (path: string) =>
    ipcRenderer.invoke('git:status', { path }),
  getGitHubAuthStatus: () =>
    ipcRenderer.invoke('git:github-auth-status'),
  loginGitHub: () =>
    ipcRenderer.invoke('git:github-login'),
  createRepo: (path: string, name: string, isPrivate: boolean) =>
    ipcRenderer.invoke('git:create-repo', { path, name, isPrivate }),
  push: (path: string) =>
    ipcRenderer.invoke('git:push', { path })
}
```

### Step 5: Create Git Status Component (1h)
`src/renderer/components/git/GitStatus.tsx`:
```tsx
import { useEffect, useState } from 'react'
import type { GitStatus as GitStatusType } from '../../../shared/types'

interface Props {
  projectPath: string
}

export function GitStatus({ projectPath }: Props) {
  const [status, setStatus] = useState<GitStatusType | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadStatus()
    const interval = setInterval(loadStatus, 5000) // Poll every 5s
    return () => clearInterval(interval)
  }, [projectPath])

  async function loadStatus() {
    const s = await window.electronAPI.git.getStatus(projectPath)
    setStatus(s)
    setLoading(false)
  }

  if (loading) return <div className="text-gray-500">Loading...</div>
  if (!status?.initialized) {
    return (
      <button
        onClick={async () => {
          await window.electronAPI.git.init(projectPath)
          loadStatus()
        }}
        className="text-blue-400 hover:text-blue-300"
      >
        Initialize Git
      </button>
    )
  }

  return (
    <div className="text-sm text-gray-400 flex items-center gap-2">
      <span className="text-green-400">{status.branch}</span>
      {status.modified > 0 && <span>M:{status.modified}</span>}
      {status.staged > 0 && <span>S:{status.staged}</span>}
      {status.untracked > 0 && <span>?:{status.untracked}</span>}
    </div>
  )
}
```

### Step 6: Create GitHub Connect Component (1h)
`src/renderer/components/git/GitHubConnect.tsx`:
```tsx
import { useEffect, useState } from 'react'

interface Props {
  projectPath: string
  projectName: string
}

export function GitHubConnect({ projectPath, projectName }: Props) {
  const [authenticated, setAuthenticated] = useState(false)
  const [loading, setLoading] = useState(true)
  const [repoUrl, setRepoUrl] = useState<string | null>(null)

  useEffect(() => {
    checkAuth()
  }, [])

  async function checkAuth() {
    const { authenticated } = await window.electronAPI.git.getGitHubAuthStatus()
    setAuthenticated(authenticated)
    setLoading(false)
  }

  async function handleLogin() {
    setLoading(true)
    await window.electronAPI.git.loginGitHub()
    checkAuth()
  }

  async function handleCreateRepo() {
    setLoading(true)
    const { url } = await window.electronAPI.git.createRepo(
      projectPath,
      projectName,
      false
    )
    setRepoUrl(url)
    setLoading(false)
  }

  if (loading) return <div className="text-gray-500">...</div>

  if (!authenticated) {
    return (
      <button
        onClick={handleLogin}
        className="px-3 py-1 bg-gray-700 rounded text-sm hover:bg-gray-600"
      >
        Connect GitHub
      </button>
    )
  }

  if (repoUrl) {
    return (
      <a href={repoUrl} className="text-blue-400 text-sm hover:underline">
        {repoUrl.replace('https://github.com/', '')}
      </a>
    )
  }

  return (
    <button
      onClick={handleCreateRepo}
      className="px-3 py-1 bg-green-700 rounded text-sm hover:bg-green-600"
    >
      Push to GitHub
    </button>
  )
}
```

### Step 7: Integration (30m)
1. Add Git components to sidebar/project view
2. Register git handlers in main process
3. Update type declarations

## Success Criteria
- [ ] Initialize git repo from UI
- [ ] Display current branch and change counts
- [ ] Detect GitHub CLI auth status
- [ ] Create GitHub repo and push with one click
- [ ] GitHub URL displayed after push

## Risk Assessment
| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| gh CLI not installed | Medium | High | Check on startup, show install prompt |
| OAuth flow interrupted | Low | Medium | Retry mechanism |
| Push fails (no commits) | Medium | Low | Check for commits before push |

## Deliverables
1. GitManager in main process
2. Git status component
3. GitHub connect component
4. IPC handlers for git operations
5. Ready for Phase 4 project management
