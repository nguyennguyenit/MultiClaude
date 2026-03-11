# Research: Modal Patterns & Git IPC Integration

**Date:** 2026-01-09 | **Task:** Git Init Modal Implementation

---

## 1. Existing Modal Component Patterns

**Reference:** `src/renderer/components/settings/telegram-config-modal.tsx`

### Structure Pattern
```typescript
interface ModalProps {
  isOpen: boolean           // Controls visibility
  onClose: () => void       // Close handler
  onSave: (...args) => void // Primary action
  // Additional state props as needed
}
```

### Key Implementation Details (lines 57-136)
- **Backdrop:** `fixed inset-0 bg-black/50 flex items-center justify-center z-50`
- **Container:** `bg-[var(--mc-bg-secondary)] rounded-lg p-4 w-96 max-w-[90vw]`
- **Header:** flex between title + close button (X icon SVG)
- **Form inputs:** CSS vars `--mc-bg-primary`, `--mc-border`, `--mc-accent`
- **Buttons:** Primary uses `--mc-accent` bg, secondary uses `--mc-bg-hover`
- **Early return:** `if (!isOpen) return null` (line 23)

### State Management Pattern
- Local `useState` for form fields
- Async handlers for IPC calls
- Loading states (e.g., `testing`)
- Result feedback display (success/error)

---

## 2. Current Project Addition Flow

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

### Flow Summary
1. Opens native folder picker via IPC
2. Extracts folder name from path
3. Creates project in store
4. Sets as active project

**Gap Identified:** No git status check before project creation - modal intercept point should be between step 1-2.

---

## 3. IPC Handlers

### PROJECT_CHECK_FOLDER (line 125-130)
**File:** `src/main/ipc/handlers.ts`

```typescript
ipcMain.handle(IPC_CHANNELS.PROJECT_CHECK_FOLDER, async (_, cwd: string) => {
  if (!existsSync(cwd)) {
    return { exists: false, isEmpty: true, isGitRepo: false, fileCount: 0 }
  }
  // ... folder checking logic
})
```

**Returns:** `{ exists, isEmpty, isGitRepo, fileCount }`

### GIT_INIT (lines 167-169)
```typescript
ipcMain.handle(IPC_CHANNELS.GIT_INIT, async (_, cwd: string) => {
  return gitManager.init(cwd)
})
```

**Returns:** `GitOperationResult` (success, message, error)

---

## 4. Project Interface

**File:** `src/shared/types/index.ts` (lines 25-32)

```typescript
export interface Project {
  id: string
  name: string
  path: string
  gitRemote?: string    // Already supports remote tracking
  createdAt: Date
  updatedAt: Date
}
```

### Related Git Types (lines 72-107)
- `GitStatus` - repo state info
- `GitOperationResult` - operation response format
- `GitConfig` - userName, userEmail

---

## 5. Recommendations for Git Init Modal

### Component Location
`src/renderer/components/project-tabs/git-init-modal.tsx`

### Props Interface
```typescript
interface GitInitModalProps {
  isOpen: boolean
  folderPath: string
  folderStatus: { exists: boolean; isGitRepo: boolean; isEmpty: boolean }
  onClose: () => void
  onInitComplete: () => void   // Continue to project creation
  onSkip: () => void           // Add project without git init
}
```

### Implementation Steps
1. Show folder info (path, status)
2. If not git repo, show "Initialize Git" option
3. Call `window.electron.git.init(path)` on confirm
4. Display result (success/error)
5. Trigger `onInitComplete` or `onSkip`

### Modified Project Addition Flow
```
handleAddProject:
  1. openFolder() -> path
  2. checkFolder(path) -> status
  3. if (!status.isGitRepo) -> show GitInitModal
     else -> proceed with project.create()
```

### Styling Consistency
- Use existing CSS variable system (`--mc-*`)
- Match modal dimensions: `w-96 max-w-[90vw]`
- Same backdrop/container styling as TelegramConfigModal

---

## Key Files Reference

| File | Lines | Purpose |
|------|-------|---------|
| `telegram-config-modal.tsx` | 1-137 | Modal pattern reference |
| `App.tsx` | 51-60 | handleAddProject flow |
| `handlers.ts` | 125-130 | PROJECT_CHECK_FOLDER |
| `handlers.ts` | 167-169 | GIT_INIT |
| `types/index.ts` | 25-32 | Project interface |
| `types/index.ts` | 72-107 | Git types |

---

## Unresolved Questions

1. Should modal auto-trigger or show toggle in UI?
2. Handle case where git init fails (permissions, etc)?
3. Add gitignore template selection in modal?
