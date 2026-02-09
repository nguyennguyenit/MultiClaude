# Phase 3: App Integration (Git Init)

**Parent:** [plan.md](./plan.md)
**Dependencies:** Phase 1, Phase 2
**Blocks:** Phase 6

---

## Overview

| Field | Value |
|-------|-------|
| Date | 2026-01-09 |
| Priority | P1 |
| Status | pending |
| Effort | 1.5h |

Add Git Init Modal state to app-store and integrate into handleAddProject flow in App.tsx.

---

## Requirements

- [ ] Add modal state to app-store (open, folder info)
- [ ] Add openGitInitModal/closeGitInitModal actions
- [ ] Modify handleAddProject to check isGitRepo
- [ ] Show modal when folder lacks .git
- [ ] Handle Skip action (add project, optionally save preference)
- [ ] Handle Init action (git init, then add project)
- [ ] Show success/error toasts

---

## Related Code

**File:** `src/renderer/stores/app-store.ts` (current state shape)
```typescript
interface AppState {
  // Terminals, Projects, UI state...
  sidebarOpen: boolean
  toggleSidebar: () => void
  activeView: ActiveView
  setActiveView: (view: ActiveView) => void
}
```

**File:** `src/renderer/App.tsx` (lines 51-60)
```typescript
const handleAddProject = useCallback(async () => {
  const path = await window.electron.project.openFolder()
  if (!path) return

  const name = path.split(/[/\\]/).pop() || 'Untitled'
  const project = await window.electron.project.create({ name, path })
  addProject(project)
  setActiveProject(project.id)
}, [addProject, setActiveProject])
```

---

## Implementation Steps

### 1. Extend App Store State

**File:** `src/renderer/stores/app-store.ts`

```typescript
interface AppState {
  // ... existing state

  // Git Init Modal
  gitInitModal: {
    isOpen: boolean
    folderPath: string
    folderName: string
  } | null
  openGitInitModal: (folderPath: string, folderName: string) => void
  closeGitInitModal: () => void
}

export const useAppStore = create<AppState>((set) => ({
  // ... existing

  // Git Init Modal
  gitInitModal: null,

  openGitInitModal: (folderPath, folderName) =>
    set({
      gitInitModal: { isOpen: true, folderPath, folderName }
    }),

  closeGitInitModal: () =>
    set({ gitInitModal: null })
}))
```

### 2. Update handleAddProject

**File:** `src/renderer/App.tsx`

```typescript
const handleAddProject = useCallback(async () => {
  const path = await window.electron.project.openFolder()
  if (!path) return

  // Check folder status
  const folderStatus = await window.electron.project.checkFolder(path)

  if (!folderStatus.exists) {
    useToastStore.getState().addToast('Selected folder does not exist', 'error')
    return
  }

  const name = path.split(/[/\\]/).pop() || 'Untitled'

  // Show Git init modal if not a repo
  if (!folderStatus.isGitRepo) {
    openGitInitModal(path, name)
    return // Wait for modal action
  }

  // Normal flow - folder already has Git
  const project = await window.electron.project.create({ name, path })
  addProject(project)
  setActiveProject(project.id)
}, [addProject, setActiveProject, openGitInitModal])
```

### 3. Add Modal Handlers in App.tsx

```typescript
// Get modal state from store
const { gitInitModal, openGitInitModal, closeGitInitModal } = useAppStore()

// Handler: Skip Git init
const handleSkipGitInit = useCallback(async (dontAskAgain: boolean) => {
  if (!gitInitModal) return

  const { folderPath, folderName } = gitInitModal

  const project = await window.electron.project.create({
    name: folderName,
    path: folderPath,
    gitInitPromptDismissed: dontAskAgain
  })

  addProject(project)
  setActiveProject(project.id)
  closeGitInitModal()
}, [gitInitModal, addProject, setActiveProject, closeGitInitModal])

// Handler: Initialize Git
const handleInitGit = useCallback(async () => {
  if (!gitInitModal) return

  const { folderPath, folderName } = gitInitModal

  // Execute git init
  const success = await window.electron.git.init(folderPath)

  if (!success) {
    useToastStore.getState().addToast('Failed to initialize Git repository', 'error')
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

  useToastStore.getState().addToast('Git repository initialized', 'info')

  // TODO (Phase 6): Check for remote and open GitHub modal
}, [gitInitModal, addProject, setActiveProject, closeGitInitModal])
```

### 4. Render Modal in App.tsx

```tsx
return (
  <div className="h-screen flex bg-[var(--mc-bg-primary)] text-[var(--mc-text-primary)]">
    {/* ... existing layout */}

    {/* Git Init Modal */}
    {gitInitModal && (
      <GitInitModal
        isOpen={gitInitModal.isOpen}
        folderPath={gitInitModal.folderPath}
        folderName={gitInitModal.folderName}
        onClose={closeGitInitModal}
        onSkip={handleSkipGitInit}
        onInitGit={handleInitGit}
      />
    )}

    {/* Other modals... */}
  </div>
)
```

### 5. Add Import

```typescript
import { GitInitModal } from './components/git-init-modal'
```

---

## Todo List

- [ ] Add gitInitModal state to app-store
- [ ] Add openGitInitModal action
- [ ] Add closeGitInitModal action
- [ ] Modify handleAddProject to check isGitRepo
- [ ] Add handleSkipGitInit handler
- [ ] Add handleInitGit handler
- [ ] Render GitInitModal in App.tsx
- [ ] Add import for GitInitModal
- [ ] Test flow with folder lacking .git

---

## Success Criteria

- [ ] Modal appears when adding folder without .git
- [ ] Modal does NOT appear for existing Git repos
- [ ] Skip adds project without Git
- [ ] Skip with "Don't ask again" saves preference
- [ ] Init creates .git directory
- [ ] Init adds project after success
- [ ] Toast shows on success/error
- [ ] Modal closes after action

---

## Notes

- Keep handler logic in App.tsx for now
- Will add GitHub modal trigger in Phase 6
- Use existing toast system for feedback
- Test with both empty and non-empty folders
