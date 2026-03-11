# GitHub Connection Modal Feature - Brainstorm Report

**Date:** 2026-01-09
**Project:** MultiClaude
**Feature:** GitHub Repository Connection Workflow
**Status:** Brainstorm Complete
**Related:** Git Init Prompt Modal (`brainstorm-260109-0800-git-init-prompt-modal.md`)

---

## Problem Statement

After users initialize Git repositories via the Git Init Modal, they need a seamless way to connect their local repo to GitHub for collaboration, backup, and CI/CD workflows. Currently, users must manually:
1. Authenticate with GitHub CLI (`gh auth login`)
2. Create GitHub repo (`gh repo create`) or copy/paste remote URL
3. Add remote (`git remote add origin <url>`)
4. Push code (`git push -u origin main`)

This creates friction and technical barriers for users unfamiliar with Git/GitHub CLI.

**Requirements:**
- Prompt users to connect GitHub after Git initialization
- Support both "Create New Repo" and "Link Existing Repo" workflows
- Handle GitHub authentication via gh CLI OAuth flow
- Auto-push code after successful connection
- Match reference UI design (dark modal with step indicator)
- Prevent re-showing for projects with existing remotes

---

## Evaluated Approaches

### Approach 1: Multi-Step Modal with Smart Auth Detection (RECOMMENDED)

**Description:**
Two-step wizard modal that auto-detects GitHub auth status and adapts UI accordingly:
- **Step 1 (Conditional):** Authenticate - only shown if `gh auth status` returns not authenticated
- **Step 2:** Configure - choose "Create New Repo" or "Link Existing" with validation

Modal appears:
1. After successful Git init (if no remote detected)
2. When user tries to push in Git panel without remote

**Pros:**
- ✅ Seamless UX - skips auth step for authenticated users
- ✅ Guided workflow prevents errors
- ✅ Matches reference UI design exactly
- ✅ Reuses existing `gh` CLI integration
- ✅ Auto-push completes full onboarding
- ✅ Real-time validation prevents invalid repo links

**Cons:**
- ❌ Requires `gh` CLI installed (already dependency for GitHub features)
- ❌ More complex modal with conditional rendering
- ❌ Network calls for validation may add latency

**Implementation Complexity:** Medium-High
**User Experience:** Excellent (fastest path to GitHub connection)

---

### Approach 2: Simple Modal with Manual Steps

**Description:**
Single-screen modal with instructions and buttons to trigger actions. No auth detection or validation.

**Pros:**
- ✅ Simpler implementation
- ✅ No network calls during modal interaction

**Cons:**
- ❌ Doesn't match reference UI design
- ❌ No validation - users can link invalid repos
- ❌ No auth guidance - users must figure out gh auth separately
- ❌ Poor UX for unauthenticated users

**Implementation Complexity:** Low
**User Experience:** Poor (lacks guidance)

**Verdict:** Rejected - doesn't meet requirements or match reference design

---

### Approach 3: Settings-Based Auto-Create

**Description:**
Settings toggle: "Auto-create GitHub repo for new projects". If enabled, silently create public repo with folder name after Git init.

**Pros:**
- ✅ Zero UI interruption
- ✅ Very simple implementation

**Cons:**
- ❌ No user consent before creating repos
- ❌ Can't link existing repos
- ❌ Doesn't match requirements
- ❌ Creates unwanted repos for temp/test projects

**Verdict:** Rejected - lacks flexibility and consent

---

## Final Recommended Solution

**Approach 1: Multi-Step Modal with Smart Auth Detection**

### Architecture Overview

```
User Flow:
1. Git Init completes (or user clicks Push without remote)
2. Check git remote -v → if remote exists, skip modal
3. Check gh auth status:
   - If authenticated → Show Step 2 only (Configure)
   - If not authenticated → Show Step 1 (Authenticate) → then Step 2
4. Step 2 - User chooses:
   A) Create New Repo → Form: name (auto-filled), public/private → gh repo create
   B) Link Existing → Input: username/repo (validated) → git remote add
5. After success → Auto-push if commits exist
6. Show success toast with GitHub repo URL
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
  gitInitPromptDismissed?: boolean // From Git init feature
  githubConnectionPromptDismissed?: boolean // NEW: Track GitHub connection dismissal
}
```

#### 2. IPC Channels (No New Channels Needed)

Reuse existing channels:
- `GITHUB_AUTH_STATUS` - Check if authenticated
- `GITHUB_LOGIN` - Trigger OAuth flow
- `GITHUB_CREATE_REPO` - Create new repo
- `GIT_ADD_REMOTE` - Add remote URL (for link existing)
- `GIT_PUSH` - Push code after connection
- `GIT_STATUS` - Check if remote exists

**Frontend validation for "Link Existing":**
- Validate format: `username/repo` regex
- Check repo exists: spawn `gh repo view username/repo` (renderer-side validation)
- Construct GitHub URL: `https://github.com/username/repo.git`
- Call `GIT_ADD_REMOTE` with constructed URL

#### 3. Backend Extensions

**File:** `src/main/git/git-manager.ts`

No new methods needed - all functionality exists:
- `getGitHubAuthStatus()` ✅
- `loginGitHub()` ✅
- `createGitHubRepo(name, isPrivate, cwd)` ✅
- `addRemote(cwd, url, name)` ✅ (already exists)
- `push(cwd)` ✅ (already exists)

**Possible enhancement (optional):**
```typescript
async getRemoteStatus(cwd: string): Promise<{
  hasRemote: boolean
  remoteName?: string
  remoteUrl?: string
  isGitHub?: boolean
}> {
  const git = this.getGit(cwd)
  const remotes = await git.getRemotes(true)
  const origin = remotes.find(r => r.name === 'origin')
  return {
    hasRemote: !!origin,
    remoteName: origin?.name,
    remoteUrl: origin?.refs?.fetch,
    isGitHub: origin?.refs?.fetch?.includes('github.com')
  }
}
```

#### 4. Frontend State Management

**File:** `src/renderer/stores/app-store.ts`

Add GitHub modal state:
```typescript
interface AppState {
  // ... existing
  githubModalOpen: boolean
  githubModalContext: {
    projectId: string
    projectPath: string
    projectName: string
    trigger: 'git-init' | 'push-attempt'
  } | null
  openGitHubModal: (context: GithubModalContext) => void
  closeGitHubModal: () => void
}
```

#### 5. New UI Component

**File:** `src/renderer/components/github-connection-modal/github-connection-modal.tsx`

**Component Structure:**
```tsx
<GitHubConnectionModal>
  {/* Dynamic Step Indicator */}
  {!isAuthenticated && (
    <StepIndicator>
      <Step active>1 Authenticate</Step>
      <Step>2 Configure</Step>
    </StepIndicator>
  )}

  {/* Step 1: Authenticate (conditional) */}
  {!isAuthenticated && (
    <AuthStep>
      <Icon>GitHub logo</Icon>
      <Title>Connect to GitHub</Title>
      <Message>You need to authenticate with GitHub to continue</Message>
      <Button onClick={handleLogin}>Login with GitHub</Button>
      <Checkbox>Don't ask again for this project</Checkbox>
      <Button variant="secondary">Skip for now</Button>
    </AuthStep>
  )}

  {/* Step 2: Configure */}
  {isAuthenticated && (
    <ConfigureStep>
      <StepIndicator>
        {hadAuthStep && <Step completed>1 Authenticate</Step>}
        <Step active>2 Configure</Step>
      </StepIndicator>
      <Title>Connect to GitHub</Title>
      <Subtitle>Create a new repo or link to existing repository</Subtitle>

      {!selectedOption && (
        <OptionsGrid>
          <OptionCard onClick={() => setOption('create')}>
            <Icon>Plus</Icon>
            <Label>Create New Repo</Label>
            <Description>Create new repository on GitHub</Description>
          </OptionCard>
          <OptionCard onClick={() => setOption('link')}>
            <Icon>Link</Icon>
            <Label>Link Existing</Label>
            <Description>Connect to an existing repository</Description>
          </OptionCard>
        </OptionsGrid>
      )}

      {selectedOption === 'create' && (
        <CreateRepoForm>
          <BackButton onClick={() => setOption(null)}>← Back</BackButton>
          <FormTitle>Create new repository</FormTitle>
          <Input label="Repository name" value={repoName} onChange={setRepoName} />
          <Toggle label="Visibility" options={['Public', 'Private']} value={visibility} onChange={setVisibility} />
          <Actions>
            <Checkbox>Don't ask again for this project</Checkbox>
            <Button variant="secondary">Skip for now</Button>
            <Button variant="primary" onClick={handleCreateRepo}>Create Repository</Button>
          </Actions>
        </CreateRepoForm>
      )}

      {selectedOption === 'link' && (
        <LinkRepoForm>
          <BackButton onClick={() => setOption(null)}>← Back Link to existing repository</BackButton>
          <Input
            label="Repository"
            placeholder="username/repository"
            helperText="Enter the full repository path (e.g., octocat/hello-world)"
            value={repoPath}
            onChange={handleRepoPathChange}
            validationStatus={validationStatus}
            validationMessage={validationMessage}
          />
          <Actions>
            <Checkbox>Don't ask again for this project</Checkbox>
            <Button variant="secondary">Skip for now</Button>
            <Button
              variant="primary"
              onClick={handleLinkRepo}
              disabled={validationStatus !== 'valid'}
            >
              Link Repository
            </Button>
          </Actions>
        </LinkRepoForm>
      )}

      <FooterActions>
        <Button variant="ghost" onClick={handleRetryDetection}>Retry Detection</Button>
      </FooterActions>
    </ConfigureStep>
  )}
</GitHubConnectionModal>
```

**Visual Design (matching reference images):**
- Dark background modal with backdrop blur
- Step indicator: Yellow highlight for active step, checkmark for completed
- Two-column grid for options (dashed borders)
- Icons: Plus (create), Link chain (link existing)
- Form inputs with yellow border focus states
- Buttons: Gray "Skip for now", Yellow "Create/Link Repository"
- Back button with arrow icon
- "Retry Detection" as ghost button in footer

#### 6. Integration Points

**File:** `src/renderer/App.tsx` (or Git Init Modal callback)

**Trigger 1: After Git Init**
```typescript
const handleInitGit = useCallback(async () => {
  const { path, name } = gitInitModalFolder!

  // Execute git init
  const success = await window.electron.git.init(path)
  if (!success) {
    useToastStore.getState().addToast('Failed to init Git', 'error')
    return
  }

  // Add project
  const project = await window.electron.project.create({ name, path })
  addProject(project)
  setActiveProject(project.id)
  closeGitInitModal()

  // Check for remote
  const status = await window.electron.git.getStatus(path)
  if (!status.hasRemote) {
    // Open GitHub connection modal
    openGitHubModal({
      projectId: project.id,
      projectPath: path,
      projectName: name,
      trigger: 'git-init'
    })
  }

  useToastStore.getState().addToast('Git initialized successfully', 'success')
}, [/* deps */])
```

**Trigger 2: Push Attempt Without Remote**

**File:** `src/renderer/components/git-panel/git-panel.tsx`
```typescript
const handlePush = useCallback(async () => {
  if (!activeProject) return

  // Check if remote exists
  const status = await window.electron.git.getStatus(activeProject.path)

  if (!status.hasRemote) {
    // Check if user dismissed GitHub prompt
    if (!activeProject.githubConnectionPromptDismissed) {
      openGitHubModal({
        projectId: activeProject.id,
        projectPath: activeProject.path,
        projectName: activeProject.name,
        trigger: 'push-attempt'
      })
      return
    } else {
      useToastStore.getState().addToast(
        'No remote configured. Add a remote to push changes.',
        'warning'
      )
      return
    }
  }

  // Normal push flow
  const result = await window.electron.git.push(activeProject.path)
  // ... handle result
}, [activeProject, openGitHubModal])
```

#### 7. Modal Action Handlers

**Authentication Flow:**
```typescript
const [isAuthenticated, setIsAuthenticated] = useState(false)
const [checkingAuth, setCheckingAuth] = useState(true)

useEffect(() => {
  checkAuthStatus()
}, [])

const checkAuthStatus = async () => {
  const auth = await window.electron.github.getAuthStatus()
  setIsAuthenticated(auth.isAuthenticated)
  setCheckingAuth(false)
}

const handleLogin = async () => {
  const result = await window.electron.github.login()
  if (result.success) {
    // gh CLI opens browser for OAuth
    // Poll for auth completion
    const pollAuth = setInterval(async () => {
      const auth = await window.electron.github.getAuthStatus()
      if (auth.isAuthenticated) {
        clearInterval(pollAuth)
        setIsAuthenticated(true)
        useToastStore.getState().addToast('Successfully authenticated with GitHub', 'success')
      }
    }, 2000)
  }
}
```

**Create New Repo Flow:**
```typescript
const [repoName, setRepoName] = useState(projectName) // Auto-fill
const [visibility, setVisibility] = useState<'public' | 'private'>('public')
const [creating, setCreating] = useState(false)

const handleCreateRepo = async () => {
  setCreating(true)

  const result = await window.electron.github.createRepo({
    name: repoName,
    isPrivate: visibility === 'private',
    cwd: projectPath
  })

  if (result.success) {
    useToastStore.getState().addToast(
      `Repository created: ${result.url}`,
      'success'
    )

    // Auto-push if commits exist
    const status = await window.electron.git.getStatus(projectPath)
    if (status.isRepo) {
      const pushResult = await window.electron.git.push(projectPath)
      if (pushResult) {
        useToastStore.getState().addToast('Code pushed to GitHub', 'success')
      }
    }

    // Update project to mark as connected
    if (dontAskAgain) {
      await window.electron.project.update(projectId, {
        githubConnectionPromptDismissed: true
      })
    }

    closeGitHubModal()

    // Open Git panel to show remote
    setActiveView('terminals') // or navigate to git panel
  } else {
    useToastStore.getState().addToast(
      `Failed to create repo: ${result.error}`,
      'error'
    )
  }

  setCreating(false)
}
```

**Link Existing Repo Flow:**
```typescript
const [repoPath, setRepoPath] = useState('')
const [validationStatus, setValidationStatus] = useState<'idle' | 'validating' | 'valid' | 'invalid'>('idle')
const [validationMessage, setValidationMessage] = useState('')

// Real-time validation
const handleRepoPathChange = async (value: string) => {
  setRepoPath(value)

  // Format validation
  const formatRegex = /^[a-zA-Z0-9_-]+\/[a-zA-Z0-9_.-]+$/
  if (!formatRegex.test(value)) {
    setValidationStatus('invalid')
    setValidationMessage('Invalid format. Use: username/repository')
    return
  }

  // Check if repo exists via gh CLI
  setValidationStatus('validating')
  setValidationMessage('Checking repository...')

  try {
    // Spawn gh repo view in renderer (or add IPC handler)
    const { exec } = require('child_process')
    const result = await new Promise((resolve) => {
      exec(`gh repo view ${value}`, (error: any, stdout: string, stderr: string) => {
        resolve({ success: !error, output: stdout })
      })
    })

    if (result.success) {
      setValidationStatus('valid')
      setValidationMessage('✓ Repository found')
    } else {
      setValidationStatus('invalid')
      setValidationMessage('Repository not found or not accessible')
    }
  } catch {
    setValidationStatus('invalid')
    setValidationMessage('Failed to validate repository')
  }
}

const handleLinkRepo = async () => {
  if (validationStatus !== 'valid') return

  // Construct GitHub URL
  const remoteUrl = `https://github.com/${repoPath}.git`

  // Add remote
  const success = await window.electron.git.addRemote(projectPath, remoteUrl)

  if (success) {
    useToastStore.getState().addToast(
      `Linked to ${repoPath}`,
      'success'
    )

    // Auto-push if commits exist
    const status = await window.electron.git.getStatus(projectPath)
    if (status.isRepo) {
      const pushResult = await window.electron.git.push(projectPath)
      if (pushResult) {
        useToastStore.getState().addToast('Code pushed to GitHub', 'success')
      }
    }

    if (dontAskAgain) {
      await window.electron.project.update(projectId, {
        githubConnectionPromptDismissed: true
      })
    }

    closeGitHubModal()
  } else {
    useToastStore.getState().addToast('Failed to add remote', 'error')
  }
}
```

**Retry Detection Flow:**
```typescript
const handleRetryDetection = async () => {
  const status = await window.electron.git.getStatus(projectPath)

  if (status.hasRemote) {
    useToastStore.getState().addToast(
      `Remote detected: ${status.remoteName} → ${status.remoteUrl}`,
      'success'
    )
    closeGitHubModal()
  } else {
    useToastStore.getState().addToast(
      'No remote detected. Please configure manually.',
      'info'
    )
  }
}
```

**Skip Flow:**
```typescript
const [dontAskAgain, setDontAskAgain] = useState(false)

const handleSkip = async () => {
  if (dontAskAgain) {
    await window.electron.project.update(projectId, {
      githubConnectionPromptDismissed: true
    })
  }
  closeGitHubModal()
}
```

---

## Implementation Considerations

### Security
- ✅ Uses official `gh` CLI for OAuth (proven, secure)
- ✅ No credential storage - delegated to gh CLI
- ✅ Repository validation prevents typosquatting
- ✅ HTTPS URLs only (no SSH key management)

### Performance
- ⚠️ Real-time validation adds network latency (200-500ms per keystroke)
  - **Mitigation:** Debounce validation (500ms delay after typing stops)
- ✅ Auth status check is cached during modal session
- ✅ Modal lazy-loaded (code splitting)

### Dependencies
- ✅ Requires `gh` CLI (already listed in docs as requirement)
- ❌ **Risk:** gh CLI not installed → show error with installation link
  - **Mitigation:** Add `gh --version` check on app startup, show warning in settings

### Edge Cases

1. **User closes browser during OAuth**
   - Solution: Show "Waiting for authentication..." with Cancel button
   - Polling stops after 5 minutes with timeout message

2. **Repo name already exists on GitHub**
   - Solution: `gh repo create` returns error → show toast: "Repo name taken. Try another."

3. **Network offline during validation**
   - Solution: Catch error, show "Unable to validate. Check connection."

4. **User manually adds remote while modal open**
   - Solution: "Retry Detection" button re-checks and closes modal if found

5. **Project deleted while modal open**
   - Solution: Re-check project existence before executing actions

6. **gh CLI version too old**
   - Solution: Check `gh version` on startup, warn if <2.0.0

### Accessibility
- ✅ Keyboard navigation (Tab, Enter, Escape)
- ✅ Screen reader labels for all inputs and buttons
- ✅ Focus management (auto-focus first input on step transitions)
- ✅ Loading states with aria-live announcements
- ✅ Error messages with aria-invalid and role="alert"

### Testing Strategy

1. **Unit Tests:**
   - Modal component rendering (different steps/states)
   - Form validation logic
   - Store actions (open/close modal, auth state)

2. **Integration Tests:**
   - Full "Create New Repo" flow with mock gh CLI
   - Full "Link Existing" flow with validation
   - Auth flow with polling
   - Skip with "Don't ask again" persistence

3. **E2E Tests (Playwright):**
   - Git init → GitHub connection sequence
   - Push without remote → modal shown
   - Authenticated user → skips auth step
   - Create repo → auto-push → verify in Git panel
   - Link existing → verify remote added
   - Retry detection after manual remote add

---

## Success Metrics

### Functional
- ✅ Modal appears after Git init if no remote
- ✅ Modal appears on push attempt if no remote
- ✅ Auth step skipped if already authenticated
- ✅ Create repo successfully with correct visibility
- ✅ Link existing repo with validation
- ✅ Auto-push after successful connection
- ✅ "Don't ask again" persists across restarts
- ✅ Retry detection closes modal when remote found

### User Experience
- ✅ Clear step-by-step guidance
- ✅ Visual design matches reference images
- ✅ Fast response (<300ms for auth check, <1s for validation)
- ✅ Helpful error messages with recovery actions
- ✅ Zero technical jargon in UI text

### Code Quality
- ✅ TypeScript types for all new interfaces
- ✅ Test coverage ≥80% for new components
- ✅ No regressions in Git panel or project flows
- ✅ Reuses existing IPC infrastructure

---

## Dependencies & Risks

### Dependencies
- ✅ `gh` CLI v2.0+ (already documented requirement)
- ✅ `simple-git` (already in use)
- ✅ Existing GitHub IPC handlers
- ✅ Git Init Modal feature (for sequential flow)

### Risks

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| gh CLI not installed | Medium | High | Detect on startup, show setup guide in settings |
| Network timeout during validation | Low | Medium | 5s timeout + retry button + manual fallback |
| OAuth browser blocked by firewall | Low | Medium | Show device code as fallback + manual instructions |
| Repo name conflicts on creation | Low | Low | Clear error message + suggest alternatives |
| User confusion with 2-step flow | Low | Medium | Clear progress indicator + contextual help text |
| gh CLI version incompatibility | Low | Medium | Version check on startup + update prompt |

---

## Integration with Git Init Modal

### Sequential Flow
```
1. User adds project folder
2. No .git detected → Git Init Modal opens
3. User clicks "Initialize Git" → Git init executes
4. Git Init Modal closes
5. Check for remote → None found
6. GitHub Connection Modal opens (seamless transition)
7. User completes GitHub setup
8. Both Git and GitHub fully configured
```

### Shared State
Both modals use similar patterns:
- Project model extensions (dismissal flags)
- Toast notifications for feedback
- Electron IPC for backend operations
- Checkbox for "Don't ask again"
- Skip button with optional persistence

### Code Reuse Opportunities
- Modal container component (backdrop, close button)
- Form input components (with validation states)
- Toast notification system
- Store patterns (modal open/close actions)

---

## File Changes Summary

### New Files (4)
1. `src/renderer/components/github-connection-modal/github-connection-modal.tsx` (~400 LOC)
2. `src/renderer/components/github-connection-modal/auth-step.tsx` (~100 LOC)
3. `src/renderer/components/github-connection-modal/configure-step.tsx` (~300 LOC)
4. `src/renderer/components/github-connection-modal/index.ts` (export)

### Modified Files (4)
1. `src/shared/types/index.ts` - Add `githubConnectionPromptDismissed` to Project
2. `src/renderer/stores/app-store.ts` - Add GitHub modal state + actions
3. `src/renderer/App.tsx` - Trigger modal after Git init
4. `src/renderer/components/git-panel/git-panel.tsx` - Trigger modal on push attempt

### Optional Enhancements (1)
1. `src/main/git/git-manager.ts` - Add `getRemoteStatus()` helper (optional, can use existing `getStatus`)

### Test Files (3)
1. `src/renderer/components/github-connection-modal/__tests__/github-connection-modal.spec.tsx`
2. `src/__tests__/e2e/tests/github-connection-modal.spec.ts`
3. Update `src/main/project/__tests__/project-store.spec.ts`

**Total Estimated LOC:** ~900 (400 main component + 400 sub-components + 100 integration)

---

## Implementation Phases

### Phase 1: Backend Preparation (30 min)
- Extend Project type with `githubConnectionPromptDismissed`
- Test existing GitHub IPC handlers
- Verify gh CLI integration works

### Phase 2: Frontend State (30 min)
- Add modal state to app-store
- Add open/close actions
- Wire up trigger points (Git init callback, push handler)

### Phase 3: Modal UI - Auth Step (1.5 hours)
- Build auth step component
- Implement auth status check on mount
- Add login button with OAuth flow
- Add polling for auth completion
- Style to match reference design

### Phase 4: Modal UI - Configure Step (2.5 hours)
- Build option selection screen (Create/Link cards)
- Build Create New Repo form (name input, visibility toggle)
- Build Link Existing form (repo path input with validation)
- Implement real-time validation with debounce
- Add Retry Detection button
- Style to match reference design

### Phase 5: Integration & Actions (1.5 hours)
- Wire create repo action (gh repo create + auto-push)
- Wire link repo action (validate + add remote + auto-push)
- Implement skip with "Don't ask again"
- Add error handling for all actions
- Add toast notifications

### Phase 6: Testing (2 hours)
- Unit tests for components
- Integration tests for workflows
- E2E tests for full flow
- Manual testing with real GitHub account

### Phase 7: Polish (1 hour)
- Accessibility improvements
- Loading states and animations
- Error recovery flows
- Edge case handling
- Documentation

**Total Estimated Time:** 9-10 hours

---

## Next Steps

**User Decision Required:** Proceed with implementation?

**If YES:**
- Option 1: `/plan:fast` - Quick implementation plan (~9-10 hours work)
- Option 2: `/plan:hard` - Detailed step-by-step plan with comprehensive edge cases (~12-15 hours work)

**Recommended:** `/plan:fast` - The brainstorm is already very detailed, fast plan should be sufficient.

---

## Unresolved Questions

None - all design decisions finalized through user input.

---

## Visual Reference

**Modal Step 1 (Authenticate):**
- Step indicator: "1 Authenticate > 2 Configure"
- Title: "Connect to GitHub"
- Message: "You need to authenticate..."
- Login button (opens browser)
- Skip for now + Don't ask again checkbox

**Modal Step 2 - Option Selection:**
- Step indicator: "2 Configure" (or "1 ✓ > 2 Configure" if came from auth)
- Title: "Connect to GitHub"
- Subtitle: "Create a new one or link to an existing repository."
- Two cards: "Create New Repo" | "Link Existing"
- Retry Detection button (footer)
- Skip for now + Don't ask again checkbox

**Modal Step 2 - Create Form:**
- Back button: "← Back Create new repository"
- Repository name input (auto-filled with folder name)
- Public/Private toggle
- Create Repository button (yellow)
- Skip for now

**Modal Step 2 - Link Form:**
- Back button: "← Back Link to existing repository"
- Repository input: "username/repository" with validation
- Helper text: "Enter the full repository path (e.g., octocat/hello-world)"
- Validation indicators (checkmark or error)
- Link Repository button (yellow, disabled if invalid)
- Skip for now

All screens match dark theme with yellow accent colors from reference images.
