# API Specification (IPC)

> Auto-generated from codebase via `/ipa:init`
> MultiClaude uses Electron IPC instead of REST API

## 1. Overview

MultiClaude is an Electron desktop app. All "API" calls are IPC (Inter-Process Communication) between:
- **Main Process**: Node.js backend (terminal, git, storage)
- **Renderer Process**: React frontend (UI)
- **Preload Script**: Secure bridge via `contextBridge`

## 2. API Modules

| Module | Description | Handler Location |
|--------|-------------|------------------|
| terminal | PTY terminal management | `src/main/terminal/` |
| project | Project CRUD operations | `src/main/project/` |
| git | Git operations | `src/main/git/` |
| github | GitHub CLI integration | `src/main/ipc/github-handlers.ts` |
| notification | Telegram/Discord alerts | `src/main/notification/` |
| settings | App preferences | `src/main/settings/` |
| update | Auto-update system | `src/main/updater/` |
| session | Window state persistence | `src/main/project/` |

## 3. Endpoint Matrix

### Terminal Module

| Method | Channel | Parameters | Returns | Status |
|--------|---------|------------|---------|--------|
| invoke | `terminal:create` | `{ cwd?, projectId?, shell? }` | `Terminal` | 🔄 |
| invoke | `terminal:destroy` | `id: string` | `boolean` | 🔄 |
| send | `terminal:input` | `{ terminalId, data }` | void | 🔄 |
| send | `terminal:resize` | `{ terminalId, cols, rows }` | void | 🔄 |
| invoke | `terminal:list` | - | `Terminal[]` | 🔄 |
| invoke | `terminal:invoke-claude` | `{ terminalId, sessionId? }` | `boolean` | 🔄 |
| invoke | `terminal:detect-wsl` | - | `WslInfo` | 🔄 |
| on | `terminal:output` | - | `{ terminalId, data }` | 🔄 |
| on | `terminal:exit` | - | `{ terminalId, exitCode }` | 🔄 |
| on | `terminal:title-change` | - | `{ terminalId, title }` | 🔄 |

### Project Module

| Method | Channel | Parameters | Returns | Status |
|--------|---------|------------|---------|--------|
| invoke | `project:list` | - | `Project[]` | 🔄 |
| invoke | `project:create` | `{ name, path }` | `Project` | 🔄 |
| invoke | `project:delete` | `id: string` | `boolean` | 🔄 |
| invoke | `project:set-active` | `id: string \| null` | `boolean` | 🔄 |
| invoke | `project:open-folder` | - | `string \| null` | 🔄 |
| invoke | `project:check-folder` | `cwd: string` | `{ exists, isEmpty, isGitRepo, fileCount }` | 🔄 |

**Note on `project:open-folder`**: Automatically converts WSL UNC paths (`\\wsl$\distro\path`, `\\wsl.localhost\distro\path`) to Linux-compatible paths.

### Git Module

| Method | Channel | Parameters | Returns | Status |
|--------|---------|------------|---------|--------|
| invoke | `git:status` | `cwd: string` | `GitStatus` | 🔄 |
| invoke | `git:init` | `cwd: string` | `boolean` | 🔄 |
| invoke | `git:add-remote` | `{ cwd, url, name? }` | `boolean` | 🔄 |
| invoke | `git:push` | `{ cwd, branch?, setUpstream? }` | `boolean` | 🔄 |
| invoke | `git:file-status` | `cwd: string` | `GitFileStatus[]` | 🔄 |
| invoke | `git:stage-file` | `{ cwd, file }` | `boolean` | 🔄 |
| invoke | `git:unstage-file` | `{ cwd, file }` | `boolean` | 🔄 |
| invoke | `git:stage-all` | `cwd: string` | `boolean` | 🔄 |
| invoke | `git:commit` | `{ cwd, message }` | `GitCommitResult` | 🔄 |
| invoke | `git:diff` | `{ cwd, file?, staged? }` | `GitDiffResult` | 🔄 |
| invoke | `git:discard` | `{ cwd, file }` | `boolean` | 🔄 |
| invoke | `git:pull` | `cwd: string` | `GitOperationResult` | 🔄 |
| invoke | `git:fetch` | `cwd: string` | `GitOperationResult` | 🔄 |
| invoke | `git:branches` | `cwd: string` | `GitBranch[]` | 🔄 |
| invoke | `git:create-branch` | `{ cwd, name, checkout? }` | `GitOperationResult` | 🔄 |
| invoke | `git:checkout-branch` | `{ cwd, name }` | `GitOperationResult` | 🔄 |
| invoke | `git:delete-branch` | `{ cwd, name, force? }` | `GitOperationResult` | 🔄 |
| invoke | `git:merge` | `{ cwd, branch }` | `GitOperationResult` | 🔄 |
| invoke | `git:log` | `{ cwd, maxCount? }` | `GitLogEntry[]` | 🔄 |
| invoke | `git:stash-list` | `cwd: string` | `GitStashEntry[]` | 🔄 |
| invoke | `git:stash-save` | `{ cwd, message? }` | `GitOperationResult` | 🔄 |
| invoke | `git:stash-apply` | `{ cwd, index? }` | `GitOperationResult` | 🔄 |
| invoke | `git:stash-pop` | `{ cwd, index? }` | `GitOperationResult` | 🔄 |
| invoke | `git:stash-drop` | `{ cwd, index? }` | `GitOperationResult` | 🔄 |
| invoke | `git:config-get` | - | `GitConfig` | 🔄 |
| invoke | `git:config-set` | `GitConfig` | `GitOperationResult` | 🔄 |
| invoke | `git:diff-branch` | `{ cwd, baseBranch }` | `GitBranchDiff` | 🔄 |
| invoke | `git:diff-against-branch` | `{ cwd, file, baseBranch }` | `GitDiffResult` | 🔄 |
| invoke | `git:watch-project` | `projectPath: string` | `boolean` | 🔄 |
| invoke | `git:unwatch-project` | `projectPath: string` | `boolean` | 🔄 |
| invoke | `git:unwatch-project` | `projectPath: string` | `boolean` | 🔄 |
| on | `git:branch-changed` | - | `{ projectPath }` | 🔄 |

### GitHub Module

| Method | Channel | Parameters | Returns | Status |
|--------|---------|------------|---------|--------|
| invoke | `github:auth-status` | - | `GitHubAuth` | 🔄 |
| invoke | `github:login` | - | `{ success, deviceCode? }` | 🔄 |
| invoke | `github:logout` | - | `GitOperationResult` | 🔄 |
| invoke | `github:create-repo` | `{ name, isPrivate, cwd? }` | `{ success, url?, error? }` | 🔄 |
| invoke | `github:list-issues` | `projectPath, state?` | `{ success, data: GitHubIssue[], error? }` | 🔄 |
| invoke | `github:list-prs` | `projectPath, state?` | `{ success, data: GitHubPR[], error? }` | 🔄 |

### Notification Module

| Method | Channel | Parameters | Returns | Status |
|--------|---------|------------|---------|--------|
| invoke | `notification:get-settings` | - | `NotificationSettings` | 🔄 |
| invoke | `notification:set-settings` | `Partial<NotificationSettings>` | `NotificationSettings` | 🔄 |
| invoke | `notification:set-telegram` | `{ botToken, chatId }` | `boolean` | 🔄 |
| invoke | `notification:set-discord` | `{ webhookUrl }` | `boolean` | 🔄 |
| invoke | `notification:get-telegram-status` | - | `boolean` | 🔄 |
| invoke | `notification:get-discord-status` | - | `boolean` | 🔄 |
| invoke | `notification:test-telegram` | `{ botToken, chatId }` | `NotificationTestResult` | 🔄 |
| invoke | `notification:test-discord` | `{ webhookUrl }` | `NotificationTestResult` | 🔄 |
| invoke | `notification:clear-telegram` | - | `boolean` | 🔄 |
| invoke | `notification:clear-discord` | - | `boolean` | 🔄 |
| send | `notification:set-active-terminal` | `terminalId: string \| null` | void | 🔄 |
| on | `notification:event` | - | `NotificationEvent` | 🔄 |

### Settings Module

| Method | Channel | Parameters | Returns | Status |
|--------|---------|------------|---------|--------|
| invoke | `settings:get` | - | `AppSettings` | 🔄 |
| invoke | `settings:set` | `Partial<AppSettings>` | `AppSettings` | 🔄 |
| invoke | `settings:reset` | - | `AppSettings` | 🔄 |

### Update Module

| Method | Channel | Parameters | Returns | Status |
|--------|---------|------------|---------|--------|
| invoke | `update:get-state` | - | `UpdateState` | 🔄 |
| invoke | `update:check` | - | `UpdateState` | 🔄 |
| invoke | `update:download` | - | `void` | 🔄 |
| invoke | `update:install` | - | `void` | 🔄 |
| on | `update:status-changed` | - | `UpdateState` | 🔄 |

### Other Modules

| Method | Channel | Parameters | Returns | Status |
|--------|---------|------------|---------|--------|
| invoke | `session:save` | `bounds?` | `boolean` | 🔄 |
| invoke | `session:restore` | - | `AppSession \| null` | 🔄 |
| invoke | `app:get-path` | `name: string` | `string` | 🔄 |
| send | `app:open-external` | `url: string` | void | 🔄 |
| invoke | `yolo:get` | `projectPath: string` | `boolean` | 🔄 |
| invoke | `yolo:set` | `{ projectPath, enabled }` | `{ success, error? }` | 🔄 |
| invoke | `clipboard:save-image` | `base64Data: string` | `string \| null` | 🔄 |
| invoke | `image:open` | `filePath: string` | `boolean` | 🔄 |
| invoke | `image:delete` | `filePath: string` | `boolean` | 🔄 |
| invoke | `image:read-base64` | `filePath: string` | `string \| null` | 🔄 |
| invoke | `file-picker:open` | - | `string[] \| null` | 🔄 |

## 4. Type Definitions

### Core Types

```typescript
interface Terminal {
  id: string
  title: string
  cwd: string
  isClaudeMode: boolean
  claudeSessionId?: string
  projectId?: string
  createdAt: Date | string
  allowTitleUpdate?: boolean
}

interface Project {
  id: string
  name: string
  path: string
  gitRemote?: string
  createdAt: Date | string
  updatedAt: Date | string
}

interface GitStatus {
  isRepo: boolean
  branch?: string
  hasRemote: boolean
  remoteName?: string
  remoteUrl?: string
  isDirty: boolean
  staged: number
  unstaged: number
  untracked: number
}

interface GitBranchDiffFile {
  path: string
  status: 'added' | 'modified' | 'deleted' | 'renamed'
  additions: number
  deletions: number
}

interface GitBranchDiff {
  baseBranch: string
  files: GitBranchDiffFile[]
  aheadBy: number
  behindBy: number
}

interface GitHubAuth {
  isAuthenticated: boolean
  username?: string
}

interface AppSettings {
  themeMode: 'light' | 'dark' | 'system'
  colorTheme: ColorTheme
  terminalLimit: TerminalLimit
  terminalRenderMode: 'performance' | 'balanced' | 'quality'
  glassmorphismEnabled: boolean
  windowsShell?: WindowsShell
  uiStyle: 'modern' | 'terminal'
  terminalStyleOptions: {
    colorPreset: 'green' | 'blue' | 'white'
    fontFamily: 'jetbrains-mono' | 'source-code-pro' | 'fira-code' | 'vt323' | 'ibm-plex-mono' | 'space-mono'
    useBorderChars: boolean
  }
}
```

## 5. Security

| Requirement | Implementation |
|-------------|----------------|
| Context Isolation | `contextBridge.exposeInMainWorld()` |
| Node Integration | Disabled in renderer |
| Preload Script | Type-safe API bridge |
| Credential Storage | `electron.safeStorage` for tokens |

## 6. Source Files

| File | Purpose |
|------|---------|
| `src/preload/index.ts` | API bridge definition |
| `src/main/ipc/handlers.ts` | Main handler registration |
| `src/main/ipc/github-handlers.ts` | GitHub-specific handlers |
| `src/shared/constants/index.ts` | IPC channel constants |
| `src/shared/types/index.ts` | Type definitions |
