# Research: GitHub Auth Flow & Store Patterns

## GitHub IPC Channels (ipc-channels.ts L57-63)

```typescript
GITHUB_AUTH_STATUS: 'github:auth-status',
GITHUB_LOGIN: 'github:login',
GITHUB_LOGOUT: 'github:logout',
GITHUB_CREATE_REPO: 'github:create-repo',
GITHUB_ISSUES_LIST: 'github:issues-list',
GITHUB_PRS_LIST: 'github:prs-list',
```

**Note:** `github-handlers.ts` only implements issues/PRs listing. Auth handlers (`AUTH_STATUS`, `LOGIN`, `LOGOUT`, `CREATE_REPO`) likely in separate file or not yet implemented.

## Git IPC Channels for Remote Operations (L22-26)

```typescript
GIT_INIT: 'git:init',
GIT_ADD_REMOTE: 'git:add-remote',
GIT_PUSH: 'git:push',
```

## App Store Patterns (app-store.ts)

**No modal state management exists.** Current UI state patterns:

```typescript
// L29-34 - Simple boolean toggles
sidebarOpen: boolean
toggleSidebar: () => void
sidebarCollapsed: boolean
toggleSidebarCollapse: () => void
activeView: ActiveView  // 'terminals' | 'github'
setActiveView: (view: ActiveView) => void
```

**Recommendation:** Create new `modal-store.ts` or add modal state to app-store:
```typescript
// Suggested pattern
activeModal: 'git-init' | 'github-connect' | null
openModal: (modal: ModalType) => void
closeModal: () => void
```

## Toast Store (toast-store.ts L3-31)

Simple notification system:

```typescript
interface Toast {
  id: string
  message: string
  type: 'info' | 'warning' | 'error'
}

addToast: (message, type = 'info') => void  // Auto-removes after 3s
removeToast: (id) => void
```

**Usage:** `useToastStore().addToast('Message', 'error')`

## Git Panel Push/Remote Detection (git-panel.tsx)

**Remote detection:** L53
```typescript
const hasRemote = gitStatus?.hasRemote
```

**Conditional UI:** L139-173 - Sync/Pull/Push buttons only render when `hasRemote` is true

**Push handler:** L74-81
```typescript
const handlePush = async () => {
  setSyncing(true)
  try {
    await push()  // From useGitPanel hook
  } finally {
    setSyncing(false)
  }
}
```

**Key hook:** `useGitPanel({ projectPath, enabled })` provides:
- `gitStatus` - Contains `hasRemote` property
- `push()` - Push operation
- `pull()` - Pull operation

## GitHub Handler Implementation (github-handlers.ts)

Uses `gh` CLI for operations:
```typescript
const { stdout } = await execAsync(
  `gh issue list --state ${validState} --json number,title,state...`,
  { cwd: projectPath }
)
```

**Pattern for auth:** Likely similar - use `gh auth status` and `gh auth login`

## Recommendations for GitHub Connection Modal

1. **New modal store** - Create `src/renderer/stores/modal-store.ts`:
   ```typescript
   type ModalType = 'git-init' | 'github-connect' | null
   ```

2. **Trigger condition** - In git-panel or changes-list, when `!hasRemote` and user attempts push:
   - Check `GITHUB_AUTH_STATUS` first
   - If not authed, show GitHub Connect modal
   - If authed but no remote, show Create Repo modal

3. **GitHub auth handlers needed** (main process):
   - `gh auth status --active` - Check auth
   - `gh auth login --web` - Login via browser
   - `gh repo create` - Create and link repo

4. **Toast usage** - Show success/error toasts after operations:
   ```typescript
   addToast('Repository created successfully!', 'info')
   addToast('GitHub authentication failed', 'error')
   ```

## File References

| Purpose | File | Lines |
|---------|------|-------|
| IPC GitHub channels | `src/shared/constants/ipc-channels.ts` | 57-63 |
| IPC Git channels | `src/shared/constants/ipc-channels.ts` | 22-56 |
| App store UI state | `src/renderer/stores/app-store.ts` | 29-34 |
| Toast store | `src/renderer/stores/toast-store.ts` | 1-31 |
| Remote detection | `src/renderer/components/git-panel/git-panel.tsx` | 53 |
| Push handling | `src/renderer/components/git-panel/git-panel.tsx` | 74-81 |
| GitHub handlers | `src/main/ipc/github-handlers.ts` | 1-49 |

## Unresolved Questions

1. Where are `GITHUB_AUTH_STATUS`, `GITHUB_LOGIN`, `GITHUB_LOGOUT`, `GITHUB_CREATE_REPO` handlers implemented? Not in `github-handlers.ts`.
2. Does `useGitPanel` hook expose auth status or only git status?
3. Should modal state live in app-store or separate modal-store?
