# Git Initialization Prompt Feature - Brainstorm Report

**Date:** 2026-01-09
**Project:** MultiClaude
**Feature:** Git Init Prompt Modal for New Project Folders
**Status:** Brainstorm Complete

---

## Problem Statement

MultiClaude currently lacks a user-friendly way to initialize Git repositories when adding new project folders. Users must manually run `git init` in terminals or remember to set up Git after adding a project. This creates friction, especially for new projects where Git is essential for Claude Code's workflow features.

**Requirements:**
- Prompt users to initialize Git when adding folders without `.git`
- Match the reference UI design (dark modal with warning banner)
- Allow users to skip/dismiss per project
- Provide quick Git initialization without manual terminal commands
- Open Git panel automatically after initialization

---

## Evaluated Approaches

### Approach 1: Modal Dialog with Immediate Check (RECOMMENDED)

**Description:**
Inject a modal component that appears immediately after `PROJECT_OPEN_FOLDER` dialog completes but **before** project is added to store. Check if folder has `.git` directory and show modal if missing.

**Pros:**
- ✅ Matches reference UI/UX exactly (blocking modal)
- ✅ Prevents adding project without Git awareness
- ✅ Clean user flow - decide upfront before proceeding
- ✅ Can reuse existing `checkFolder` IPC handler with minor extension
- ✅ Minimal state management (modal controls flow)

**Cons:**
- ❌ Blocks project addition flow (by design)
- ❌ Adds complexity to `handleAddProject` function
- ❌ Requires new modal component (~200 LOC)

**Implementation Complexity:** Medium
**User Experience:** Excellent (clear, guided)

---

### Approach 2: Post-Addition Toast Notification

**Description:**
Add project first, then check Git status and show dismissible toast notification asking to init Git.

**Pros:**
- ✅ Non-blocking, faster project addition
- ✅ Simpler implementation (reuse toast system)
- ✅ Less intrusive for users

**Cons:**
- ❌ Users may miss the notification
- ❌ Doesn't match reference UI design
- ❌ Git init happens after project is already loaded (awkward timing)
- ❌ Requires additional logic to track which projects showed notification

**Implementation Complexity:** Low
**User Experience:** Fair (easy to miss)

**Verdict:** Rejected - doesn't match requirements or reference design

---

### Approach 3: Settings-Based Auto Init

**Description:**
Add Settings toggle "Auto-initialize Git for new projects". If enabled, silently run `git init` for folders without `.git`.

**Pros:**
- ✅ Zero UI interruption (fully automated)
- ✅ Very simple implementation
- ✅ Power users can enable once and forget

**Cons:**
- ❌ No user consent before modifying folders
- ❌ Doesn't match reference UI design
- ❌ Users might not notice Git was initialized
- ❌ All-or-nothing approach (no per-project choice)
- ❌ Potentially unwanted for temporary/test folders

**Implementation Complexity:** Low
**User Experience:** Poor (lacks control/awareness)

**Verdict:** Rejected - too aggressive, no user consent

---

## Final Recommended Solution

**Approach 1: Modal Dialog with Immediate Check**

### Architecture Overview

```
User Flow:
1. Click "Add Project" → Opens folder picker dialog
2. Select folder → Check if .git exists via IPC
3. If no .git → Show GitInitModal (blocking)
   - User chooses: Skip / Don't ask for this project / Initialize Git
4. If "Initialize Git" → Execute git init via IPC
5. Add project to store → Set active project
6. If Git initialized → Open sidebar Git panel automatically
```

### Technical Design

#### 1. Data Model Changes

**File:** `src/shared/types/index.ts`

Extend `Project` interface:
```typescript
interface Project {
  id: string
  name: string
  path: string
  createdAt: Date
  updatedAt: Date
  gitInitPromptDismissed?: boolean // NEW: Track if user dismissed Git init for this folder
}
```

#### 2. IPC Channel Extension

**File:** `src/shared/constants/ipc-channels.ts`

Add new channel (optional - can reuse existing `PROJECT_CHECK_FOLDER`):
```typescript
GIT_INIT_WITH_COMMIT: 'git:init-with-commit' // For future enhancement
```

#### 3. Backend Changes

**File:** `src/main/ipc/handlers.ts`

Extend `PROJECT_CHECK_FOLDER` response:
```typescript
{
  exists: boolean
  isEmpty: boolean
  isGitRepo: boolean
  fileCount: number
  needsGitInit: boolean // NEW: Helper flag = exists && !isGitRepo
}
```

No additional IPC handlers needed - reuse existing `GIT_INIT` channel.

#### 4. Frontend State Management

**File:** `src/renderer/stores/app-store.ts`

Add modal state:
```typescript
interface AppState {
  // ... existing
  gitInitModalOpen: boolean
  gitInitModalFolder: { path: string, name: string } | null
  openGitInitModal: (path: string, name: string) => void
  closeGitInitModal: () => void
}
```

#### 5. New UI Component

**File:** `src/renderer/components/git-init-modal/git-init-modal.tsx`

**Component Structure:**
```tsx
<GitInitModal>
  <Header icon="GitBranch" title="Git Repository Required" onClose />
  <WarningBanner>Auto Claude uses git to safely build features...</WarningBanner>
  <StatusMessage icon="AlertCircle" variant="warning">
    This folder is not a git repository
    Git needs to be initialized before Auto Claude can manage your code.
  </StatusMessage>
  <InfoSection>We'll set up git for you:</InfoSection>
  <ActionsList>
    <ActionItem icon="GitBranch">Initialize a new git repository</ActionItem>
  </ActionsList>
  <ManualInstructions collapsible>
    Open a terminal in your project folder and run:
    git init
  </ManualInstructions>
  <Footer>
    <Checkbox>Don't ask again for this project</Checkbox>
    <Button variant="secondary">Skip for now</Button>
    <Button variant="primary">Initialize Git</Button>
  </Footer>
</GitInitModal>
```

**Visual Design (matching reference image):**
- Dark background modal with blur backdrop
- Blue info banner at top
- Yellow warning icon with message
- Collapsible "Prefer to do it manually?" section
- Two action buttons: gray "Skip for now", yellow "Initialize Git"
- Checkbox for "Don't ask again"

#### 6. Integration Point

**File:** `src/renderer/App.tsx`

Modify `handleAddProject` function:

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

  // Show Git init prompt if needed
  if (!folderStatus.isGitRepo) {
    openGitInitModal(path, name)
    return // Wait for modal action
  }

  // Normal flow - add project directly
  const project = await window.electron.project.create({ name, path })
  addProject(project)
  setActiveProject(project.id)
}, [addProject, setActiveProject, openGitInitModal])
```

Modal action handlers:
```typescript
// Skip for now
const handleSkipGitInit = useCallback(async (dontAskAgain: boolean) => {
  const { path, name } = gitInitModalFolder!
  const project = await window.electron.project.create({
    name,
    path,
    gitInitPromptDismissed: dontAskAgain
  })
  addProject(project)
  setActiveProject(project.id)
  closeGitInitModal()
}, [gitInitModalFolder, addProject, setActiveProject, closeGitInitModal])

// Initialize Git
const handleInitGit = useCallback(async () => {
  const { path, name } = gitInitModalFolder!

  // Execute git init
  const success = await window.electron.git.init(path)

  if (!success) {
    useToastStore.getState().addToast('Failed to initialize Git repository', 'error')
    return
  }

  // Add project
  const project = await window.electron.project.create({ name, path })
  addProject(project)
  setActiveProject(project.id)
  closeGitInitModal()

  // Open Git panel automatically
  setActiveView('terminals') // Ensure terminals view is active
  // Git panel opens automatically when project with Git is selected

  useToastStore.getState().addToast('Git repository initialized successfully', 'success')
}, [gitInitModalFolder, addProject, setActiveProject, closeGitInitModal, setActiveView])
```

---

## Implementation Considerations

### Security
- ✅ No security concerns - `git init` is safe operation
- ✅ Path validation already exists in `checkFolder` handler
- ✅ No user input injection risks (no commit messages)

### Performance
- ✅ `git init` is instant (<100ms for empty folders)
- ✅ `checkFolder` IPC call already exists (no extra overhead)
- ✅ Modal render is lightweight (~200 LOC component)

### Edge Cases
1. **Folder deleted between selection and modal action**
   - Solution: Re-check folder existence before `git init`

2. **User manually inits Git while modal open**
   - Solution: Re-check Git status before executing `git init`

3. **Permission errors during `git init`**
   - Solution: Show error toast, allow retry or skip

4. **Folder already dismissed but user wants to init later**
   - Solution: Add "Initialize Git" button in Git panel when repo not detected

### Accessibility
- ✅ Modal keyboard navigation (Tab, Escape to close)
- ✅ Screen reader labels for all interactive elements
- ✅ Focus trap within modal
- ✅ Clear visual indicators (icons + text)

### Testing Strategy
1. **Unit Tests:**
   - Modal component rendering
   - Store actions (open/close modal)
   - Checkbox state management

2. **Integration Tests:**
   - Full flow: select folder → show modal → init git
   - "Don't ask again" persistence
   - Error handling (failed git init)

3. **E2E Tests (Playwright):**
   - Add project with Git → no modal shown
   - Add project without Git → modal appears
   - Click "Skip" vs "Initialize Git"
   - "Don't ask again" checkbox behavior

---

## Success Metrics

1. **Functional:**
   - ✅ Modal appears for folders without `.git`
   - ✅ Modal does NOT appear for Git repos or dismissed projects
   - ✅ Git initialized successfully on "Initialize Git" click
   - ✅ Git panel opens automatically after init
   - ✅ "Don't ask again" preference persists across restarts

2. **User Experience:**
   - ✅ Clear, non-technical language in modal
   - ✅ Visual design matches reference image
   - ✅ Fast response (<200ms from folder selection to modal)
   - ✅ Zero friction for users who want Git (1 click to init)

3. **Code Quality:**
   - ✅ TypeScript types for all new interfaces
   - ✅ Test coverage ≥80% for new components
   - ✅ No regressions in existing project addition flow

---

## Dependencies & Risks

### Dependencies
- ✅ `simple-git` (already in use) - handles `git init`
- ✅ `electron-store` (already in use) - persists preferences
- ✅ Existing IPC infrastructure - no new packages needed

### Risks

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Modal blocks workflow for users who don't want Git | Low | Medium | Clear "Skip for now" button + "Don't ask again" checkbox |
| Users confused by technical Git terminology | Low | Low | Use plain language like reference UI ("Auto Claude needs Git to safely build features") |
| Git init fails on Windows with permission issues | Low | Medium | Error handling + manual instructions fallback |
| Modal design doesn't match existing UI theme | Low | Low | Use existing Tailwind classes + MultiClaude color scheme |

---

## File Changes Summary

### New Files (2)
1. `src/renderer/components/git-init-modal/git-init-modal.tsx` (~200 LOC)
2. `src/renderer/components/git-init-modal/index.ts` (export)

### Modified Files (5)
1. `src/shared/types/index.ts` - Add `gitInitPromptDismissed` to Project
2. `src/renderer/stores/app-store.ts` - Add modal state + actions
3. `src/renderer/App.tsx` - Integrate modal in `handleAddProject`
4. `src/main/project/project-store.ts` - Support new Project field
5. `src/main/ipc/handlers.ts` - Minor extension to `PROJECT_CHECK_FOLDER` response

### Test Files (3)
1. `src/renderer/components/git-init-modal/__tests__/git-init-modal.spec.tsx`
2. `src/__tests__/e2e/tests/git-init-modal.spec.ts`
3. Update `src/main/project/__tests__/project-store.spec.ts`

**Total Estimated LOC:** ~400 (200 component + 100 tests + 100 integration)

---

## Next Steps

**User Decision Required:** Proceed with implementation?

**If YES:**
- Option 1: Use `/plan:fast` for quick implementation plan (~1-2 hours work)
- Option 2: Use `/plan:hard` for detailed step-by-step plan with edge cases (~3-4 hours work)

**Implementation Phases:**
1. **Phase 1:** Backend - Extend Project model + IPC handlers (30 min)
2. **Phase 2:** Frontend - Add modal state to store (15 min)
3. **Phase 3:** UI Component - Build GitInitModal matching reference design (2 hours)
4. **Phase 4:** Integration - Wire modal into App.tsx flow (30 min)
5. **Phase 5:** Testing - Unit + E2E tests (1 hour)
6. **Phase 6:** Polish - Accessibility, error handling, edge cases (1 hour)

**Total Estimated Time:** 5-6 hours

---

## Unresolved Questions

None - all design decisions finalized through user input.
