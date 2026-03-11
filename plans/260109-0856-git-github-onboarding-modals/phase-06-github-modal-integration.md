# Phase 6: GitHub Modal Integration

**Parent:** [plan.md](./plan.md)
**Dependencies:** Phase 3, Phase 4, Phase 5
**Blocks:** Phase 7

---

## Overview

| Field | Value |
|-------|-------|
| Date | 2026-01-09 |
| Priority | P1 |
| Status | pending |
| Effort | 2h |

Add GitHub modal state to app-store and integrate triggers from Git Init callback and git-panel push.

---

## Requirements

- [ ] Add GitHub modal state to app-store
- [ ] Trigger modal after Git init (if no remote)
- [ ] Trigger modal on push attempt without remote
- [ ] Handle skip with preference persistence
- [ ] Handle complete with project update
- [ ] Respect dismissed preference

---

## Related Code

**File:** `src/renderer/stores/app-store.ts`
```typescript
// Phase 3 added gitInitModal state
gitInitModal: { isOpen: boolean; folderPath: string; folderName: string } | null
```

**File:** `src/renderer/App.tsx` (Phase 3 handleInitGit)
```typescript
// After git init success, check for remote and open GitHub modal
```

**File:** `src/renderer/components/git-panel/git-panel.tsx` (lines 74-81)
```typescript
const handlePush = async () => {
  setSyncing(true)
  try {
    await push()
  } finally {
    setSyncing(false)
  }
}
```

---

## Implementation Steps

### 1. Add GitHub Modal State to Store

**File:** `src/renderer/stores/app-store.ts`

```typescript
interface GitHubModalContext {
  projectId: string
  projectPath: string
  projectName: string
  trigger: 'git-init' | 'push-attempt'
}

interface AppState {
  // ... existing

  // GitHub Connection Modal
  githubModal: GitHubModalContext | null
  openGitHubModal: (context: GitHubModalContext) => void
  closeGitHubModal: () => void
}

export const useAppStore = create<AppState>((set) => ({
  // ... existing

  // GitHub Connection Modal
  githubModal: null,

  openGitHubModal: (context) =>
    set({ githubModal: context }),

  closeGitHubModal: () =>
    set({ githubModal: null })
}))
```

### 2. Update handleInitGit in App.tsx

**File:** `src/renderer/App.tsx`

```typescript
const handleInitGit = useCallback(async () => {
  if (!gitInitModal) return

  const { folderPath, folderName } = gitInitModal

  // Execute git init
  const success = await window.electron.git.init(folderPath)

  if (!success) {
    useToastStore.getState().addToast('Failed to initialize Git', 'error')
    return
  }

  // Add project
  const project = await window.electron.project.create({
    name: folderName,
    path: folderPath
  })

  addProject(project)
  setActiveProject(project.id)
  closeGitInitModal()

  useToastStore.getState().addToast('Git initialized', 'info')

  // Check for remote - should be none after fresh init
  const status = await window.electron.git.getStatus(folderPath)
  if (!status.hasRemote) {
    // Open GitHub connection modal
    openGitHubModal({
      projectId: project.id,
      projectPath: folderPath,
      projectName: folderName,
      trigger: 'git-init'
    })
  }
}, [gitInitModal, addProject, setActiveProject, closeGitInitModal, openGitHubModal])
```

### 3. Add GitHub Modal Handlers in App.tsx

```typescript
const { githubModal, openGitHubModal, closeGitHubModal } = useAppStore()

// Handler: Skip GitHub connection
const handleSkipGitHub = useCallback(async (dontAskAgain: boolean) => {
  if (!githubModal) return

  if (dontAskAgain) {
    // Update project preference
    await window.electron.project.update(githubModal.projectId, {
      githubConnectionPromptDismissed: true
    })
    // Update local state
    // ... or refetch projects
  }

  closeGitHubModal()
}, [githubModal, closeGitHubModal])

// Handler: Complete GitHub connection
const handleCompleteGitHub = useCallback(async (dontAskAgain: boolean) => {
  if (!githubModal) return

  if (dontAskAgain) {
    await window.electron.project.update(githubModal.projectId, {
      githubConnectionPromptDismissed: true
    })
  }

  closeGitHubModal()
}, [githubModal, closeGitHubModal])
```

### 4. Render GitHub Modal in App.tsx

```tsx
return (
  <div className="h-screen flex ...">
    {/* ... existing layout */}

    {/* Git Init Modal */}
    {gitInitModal && (
      <GitInitModal ... />
    )}

    {/* GitHub Connection Modal */}
    {githubModal && (
      <GitHubConnectionModal
        isOpen={true}
        projectPath={githubModal.projectPath}
        projectName={githubModal.projectName}
        onClose={closeGitHubModal}
        onSkip={handleSkipGitHub}
        onComplete={handleCompleteGitHub}
      />
    )}
  </div>
)
```

### 5. Add Push Trigger in Git Panel

**File:** `src/renderer/components/git-panel/git-panel.tsx`

```typescript
// Import store hook
import { useAppStore } from '../../stores'

// Inside GitPanel component:
const { openGitHubModal } = useAppStore()

const handlePush = async () => {
  // Check if remote exists
  if (!hasRemote) {
    // Get active project
    const activeProject = projects.find(p => p.path === projectPath)

    if (activeProject && !activeProject.githubConnectionPromptDismissed) {
      openGitHubModal({
        projectId: activeProject.id,
        projectPath: projectPath!,
        projectName: activeProject.name,
        trigger: 'push-attempt'
      })
      return
    } else {
      useToastStore.getState().addToast(
        'No remote configured. Add a remote to push.',
        'warning'
      )
      return
    }
  }

  // Normal push flow
  setSyncing(true)
  try {
    await push()
  } finally {
    setSyncing(false)
  }
}
```

### 6. Add Project Update IPC (if not exists)

**File:** `src/main/ipc/handlers.ts`

```typescript
ipcMain.handle(IPC_CHANNELS.PROJECT_UPDATE, async (_, id: string, data: Partial<Project>) => {
  return projectStore.updateProject(id, data)
})
```

**File:** `src/shared/constants/ipc-channels.ts`

```typescript
PROJECT_UPDATE: 'project:update',
```

**File:** `src/preload/index.ts`

```typescript
project: {
  // ... existing
  update: (id: string, data: Partial<Project>) =>
    ipcRenderer.invoke(IPC_CHANNELS.PROJECT_UPDATE, id, data)
}
```

---

## Todo List

- [ ] Add githubModal state to app-store
- [ ] Add openGitHubModal action
- [ ] Add closeGitHubModal action
- [ ] Update handleInitGit to trigger GitHub modal
- [ ] Add handleSkipGitHub handler
- [ ] Add handleCompleteGitHub handler
- [ ] Render GitHubConnectionModal in App.tsx
- [ ] Modify git-panel handlePush to check remote
- [ ] Add PROJECT_UPDATE IPC if missing
- [ ] Test full flow: add folder -> git init -> github modal
- [ ] Test push trigger without remote

---

## Success Criteria

- [ ] GitHub modal appears after Git init (when no remote)
- [ ] GitHub modal appears on push without remote
- [ ] Skip saves preference when checkbox checked
- [ ] Complete closes modal
- [ ] Preference persists across restarts
- [ ] Push works normally when remote exists

---

## Notes

- Project.update may need to be added to IPC handlers
- Ensure project store persists new fields
- Test preference respecting on subsequent push attempts
- Consider edge case: remote added externally while modal open
