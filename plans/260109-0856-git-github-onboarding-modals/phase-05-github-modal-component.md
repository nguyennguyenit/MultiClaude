# Phase 5: GitHub Modal Component

**Parent:** [plan.md](./plan.md)
**Dependencies:** Phase 1, Phase 4
**Blocks:** Phase 6

---

## Overview

| Field | Value |
|-------|-------|
| Date | 2026-01-09 |
| Priority | P1 |
| Status | pending |
| Effort | 4h |

Build multi-step GitHub Connection Modal with auth step and configure step (create/link repo options).

---

## Requirements

- [ ] Two-step wizard: Authenticate -> Configure
- [ ] Auth step skipped if already authenticated
- [ ] Auth step polls for completion after login trigger
- [ ] Configure step has Create/Link option cards
- [ ] Create form: repo name (auto-filled), public/private toggle
- [ ] Link form: username/repo input with validation
- [ ] "Don't ask again" checkbox on all screens
- [ ] Skip button on all screens
- [ ] Loading states for async operations
- [ ] Retry Detection button

---

## Related Code

**Modal Pattern:** `src/renderer/components/settings/discord-config-modal.tsx`

**GitHub Types:** `src/shared/types/index.ts` (lines 85-88)
```typescript
export interface GitHubAuth {
  isAuthenticated: boolean
  username?: string
}
```

---

## Implementation Steps

### 1. Create Component Directory Structure

```
src/renderer/components/github-connection-modal/
  github-connection-modal.tsx  (~200 LOC)
  auth-step.tsx                (~100 LOC)
  configure-step.tsx           (~250 LOC)
  index.ts
```

### 2. Main Modal Component

**File:** `github-connection-modal.tsx`

```tsx
import { useState, useEffect } from 'react'
import { AuthStep } from './auth-step'
import { ConfigureStep } from './configure-step'
import type { GitHubAuth } from '@shared/types'

interface GitHubConnectionModalProps {
  isOpen: boolean
  projectPath: string
  projectName: string
  onClose: () => void
  onSkip: (dontAskAgain: boolean) => void
  onComplete: (dontAskAgain: boolean) => void
}

export function GitHubConnectionModal({
  isOpen,
  projectPath,
  projectName,
  onClose,
  onSkip,
  onComplete
}: GitHubConnectionModalProps) {
  const [auth, setAuth] = useState<GitHubAuth | null>(null)
  const [checkingAuth, setCheckingAuth] = useState(true)
  const [hadAuthStep, setHadAuthStep] = useState(false)

  // Check auth on mount
  useEffect(() => {
    if (!isOpen) return
    checkAuth()
  }, [isOpen])

  const checkAuth = async () => {
    setCheckingAuth(true)
    const status = await window.electron.github.getAuthStatus()
    setAuth(status)
    if (!status.isAuthenticated) {
      setHadAuthStep(true)
    }
    setCheckingAuth(false)
  }

  if (!isOpen) return null

  if (checkingAuth) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
        <div className="bg-[var(--mc-bg-secondary)] rounded-lg p-6 w-[480px]">
          <p className="text-center text-sm">Checking GitHub authentication...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-[var(--mc-bg-secondary)] rounded-lg w-[480px] max-w-[90vw] overflow-hidden">
        {!auth?.isAuthenticated ? (
          <AuthStep
            onClose={onClose}
            onSkip={onSkip}
            onAuthComplete={checkAuth}
            hadAuthStep={hadAuthStep}
          />
        ) : (
          <ConfigureStep
            projectPath={projectPath}
            projectName={projectName}
            username={auth.username}
            onClose={onClose}
            onSkip={onSkip}
            onComplete={onComplete}
            hadAuthStep={hadAuthStep}
          />
        )}
      </div>
    </div>
  )
}
```

### 3. Auth Step Component

**File:** `auth-step.tsx`

```tsx
import { useState, useEffect } from 'react'

interface AuthStepProps {
  onClose: () => void
  onSkip: (dontAskAgain: boolean) => void
  onAuthComplete: () => void
  hadAuthStep: boolean
}

export function AuthStep({ onClose, onSkip, onAuthComplete, hadAuthStep }: AuthStepProps) {
  const [dontAskAgain, setDontAskAgain] = useState(false)
  const [loggingIn, setLoggingIn] = useState(false)

  // Poll for auth after login triggered
  useEffect(() => {
    if (!loggingIn) return

    const pollInterval = setInterval(async () => {
      const status = await window.electron.github.getAuthStatus()
      if (status.isAuthenticated) {
        clearInterval(pollInterval)
        setLoggingIn(false)
        onAuthComplete()
      }
    }, 2000)

    // Timeout after 5 minutes
    const timeout = setTimeout(() => {
      clearInterval(pollInterval)
      setLoggingIn(false)
    }, 300000)

    return () => {
      clearInterval(pollInterval)
      clearTimeout(timeout)
    }
  }, [loggingIn, onAuthComplete])

  const handleLogin = async () => {
    setLoggingIn(true)
    await window.electron.github.login()
  }

  return (
    <>
      {/* Step Indicator */}
      <div className="px-4 py-2 border-b border-[var(--mc-border)] flex gap-4">
        <div className="flex items-center gap-2 text-[var(--mc-accent)]">
          <span className="w-5 h-5 rounded-full bg-[var(--mc-accent)] text-[var(--mc-bg-primary)] text-xs flex items-center justify-center">1</span>
          <span className="text-xs font-medium">Authenticate</span>
        </div>
        <div className="flex items-center gap-2 text-[var(--mc-text-muted)]">
          <span className="w-5 h-5 rounded-full bg-[var(--mc-bg-hover)] text-xs flex items-center justify-center">2</span>
          <span className="text-xs">Configure</span>
        </div>
      </div>

      {/* Header */}
      <div className="px-4 py-3 border-b border-[var(--mc-border)] flex items-center justify-between">
        <div className="flex items-center gap-2">
          <GitHubIcon />
          <span className="font-medium">Connect to GitHub</span>
        </div>
        <button onClick={onClose} className="p-1 hover:bg-[var(--mc-bg-hover)] rounded">
          <XIcon />
        </button>
      </div>

      {/* Content */}
      <div className="p-6 text-center">
        <GitHubIcon className="w-12 h-12 mx-auto mb-4 text-[var(--mc-text-muted)]" />
        <p className="text-sm text-[var(--mc-text-primary)] mb-2">
          {loggingIn ? 'Waiting for authentication...' : 'You need to authenticate with GitHub'}
        </p>
        <p className="text-xs text-[var(--mc-text-muted)] mb-6">
          {loggingIn
            ? 'Complete the login in your browser'
            : 'Sign in to create or link repositories'}
        </p>

        <button
          onClick={handleLogin}
          disabled={loggingIn}
          className="px-4 py-2 bg-[var(--mc-accent)] text-[var(--mc-bg-primary)] rounded hover:opacity-90 disabled:opacity-50"
        >
          {loggingIn ? 'Authenticating...' : 'Login with GitHub'}
        </button>
      </div>

      {/* Footer */}
      <div className="px-4 py-3 border-t border-[var(--mc-border)] flex items-center justify-between">
        <label className="flex items-center gap-2 text-xs text-[var(--mc-text-muted)]">
          <input
            type="checkbox"
            checked={dontAskAgain}
            onChange={(e) => setDontAskAgain(e.target.checked)}
          />
          Don't ask again for this project
        </label>
        <button
          onClick={() => onSkip(dontAskAgain)}
          className="px-3 py-1.5 text-xs bg-[var(--mc-bg-hover)] rounded hover:bg-[var(--mc-bg-active)]"
        >
          Skip for now
        </button>
      </div>
    </>
  )
}
```

### 4. Configure Step Component

**File:** `configure-step.tsx`

```tsx
import { useState } from 'react'
import { useToastStore } from '../../stores'

interface ConfigureStepProps {
  projectPath: string
  projectName: string
  username?: string
  onClose: () => void
  onSkip: (dontAskAgain: boolean) => void
  onComplete: (dontAskAgain: boolean) => void
  hadAuthStep: boolean
}

type View = 'options' | 'create' | 'link'

export function ConfigureStep({
  projectPath,
  projectName,
  username,
  onClose,
  onSkip,
  onComplete,
  hadAuthStep
}: ConfigureStepProps) {
  const [view, setView] = useState<View>('options')
  const [dontAskAgain, setDontAskAgain] = useState(false)

  // Create form state
  const [repoName, setRepoName] = useState(projectName)
  const [isPrivate, setIsPrivate] = useState(false)
  const [creating, setCreating] = useState(false)

  // Link form state
  const [repoPath, setRepoPath] = useState('')
  const [validating, setValidating] = useState(false)
  const [validationStatus, setValidationStatus] = useState<'idle' | 'valid' | 'invalid'>('idle')
  const [linking, setLinking] = useState(false)

  const { addToast } = useToastStore()

  // Debounced validation for link input
  const validateRepoPath = async (value: string) => {
    if (!value || !/^[\w-]+\/[\w.-]+$/.test(value)) {
      setValidationStatus('idle')
      return
    }

    setValidating(true)
    // Check via gh CLI (could add IPC handler or spawn in main)
    try {
      const response = await fetch(`https://api.github.com/repos/${value}`)
      setValidationStatus(response.ok ? 'valid' : 'invalid')
    } catch {
      setValidationStatus('invalid')
    }
    setValidating(false)
  }

  const handleCreate = async () => {
    setCreating(true)
    const result = await window.electron.github.createRepo({
      name: repoName,
      isPrivate,
      cwd: projectPath
    })

    if (result.success) {
      addToast(`Repository created: ${result.url}`, 'info')
      onComplete(dontAskAgain)
    } else {
      addToast(result.error || 'Failed to create repository', 'error')
    }
    setCreating(false)
  }

  const handleLink = async () => {
    setLinking(true)
    const remoteUrl = `https://github.com/${repoPath}.git`

    const success = await window.electron.git.addRemote(projectPath, remoteUrl, 'origin')
    if (success) {
      addToast(`Linked to ${repoPath}`, 'info')

      // Auto-push
      const pushResult = await window.electron.git.push(projectPath, 'main', true)
      if (pushResult?.success) {
        addToast('Code pushed to GitHub', 'info')
      }

      onComplete(dontAskAgain)
    } else {
      addToast('Failed to add remote', 'error')
    }
    setLinking(false)
  }

  const handleRetryDetection = async () => {
    const status = await window.electron.git.getStatus(projectPath)
    if (status.hasRemote) {
      addToast(`Remote detected: ${status.remoteUrl}`, 'info')
      onComplete(dontAskAgain)
    } else {
      addToast('No remote detected', 'info')
    }
  }

  return (
    <>
      {/* Step Indicator */}
      <div className="px-4 py-2 border-b border-[var(--mc-border)] flex gap-4">
        {hadAuthStep && (
          <div className="flex items-center gap-2 text-green-400">
            <span className="w-5 h-5 rounded-full bg-green-500/20 text-xs flex items-center justify-center">
              <CheckIcon />
            </span>
            <span className="text-xs">Authenticate</span>
          </div>
        )}
        <div className="flex items-center gap-2 text-[var(--mc-accent)]">
          <span className="w-5 h-5 rounded-full bg-[var(--mc-accent)] text-[var(--mc-bg-primary)] text-xs flex items-center justify-center">
            {hadAuthStep ? '2' : '1'}
          </span>
          <span className="text-xs font-medium">Configure</span>
        </div>
      </div>

      {/* Header */}
      <div className="px-4 py-3 border-b border-[var(--mc-border)] flex items-center justify-between">
        <div className="flex items-center gap-2">
          {view !== 'options' && (
            <button onClick={() => setView('options')} className="p-1 hover:bg-[var(--mc-bg-hover)] rounded">
              <ArrowLeftIcon />
            </button>
          )}
          <span className="font-medium">
            {view === 'options' && 'Connect to GitHub'}
            {view === 'create' && 'Create new repository'}
            {view === 'link' && 'Link to existing repository'}
          </span>
        </div>
        <button onClick={onClose} className="p-1 hover:bg-[var(--mc-bg-hover)] rounded">
          <XIcon />
        </button>
      </div>

      {/* Content */}
      <div className="p-4">
        {view === 'options' && (
          <>
            <p className="text-xs text-[var(--mc-text-muted)] mb-4">
              Create a new repository or link to an existing one.
            </p>
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => setView('create')}
                className="p-4 border border-dashed border-[var(--mc-border)] rounded-lg hover:border-[var(--mc-accent)] hover:bg-[var(--mc-bg-hover)] text-left"
              >
                <PlusIcon className="w-6 h-6 mb-2 text-[var(--mc-accent)]" />
                <p className="text-sm font-medium">Create New Repo</p>
                <p className="text-xs text-[var(--mc-text-muted)]">Create new repository on GitHub</p>
              </button>
              <button
                onClick={() => setView('link')}
                className="p-4 border border-dashed border-[var(--mc-border)] rounded-lg hover:border-[var(--mc-accent)] hover:bg-[var(--mc-bg-hover)] text-left"
              >
                <LinkIcon className="w-6 h-6 mb-2 text-[var(--mc-accent)]" />
                <p className="text-sm font-medium">Link Existing</p>
                <p className="text-xs text-[var(--mc-text-muted)]">Connect to existing repository</p>
              </button>
            </div>
          </>
        )}

        {view === 'create' && (
          <div className="space-y-4">
            <div>
              <label className="text-xs text-[var(--mc-text-muted)] block mb-1">Repository name</label>
              <input
                value={repoName}
                onChange={(e) => setRepoName(e.target.value)}
                className="w-full px-3 py-2 bg-[var(--mc-bg-primary)] border border-[var(--mc-border)] rounded focus:border-[var(--mc-accent)] focus:outline-none"
              />
            </div>
            <div>
              <label className="text-xs text-[var(--mc-text-muted)] block mb-2">Visibility</label>
              <div className="flex gap-2">
                <button
                  onClick={() => setIsPrivate(false)}
                  className={`flex-1 px-3 py-2 text-sm rounded ${!isPrivate ? 'bg-[var(--mc-accent)] text-[var(--mc-bg-primary)]' : 'bg-[var(--mc-bg-hover)]'}`}
                >
                  Public
                </button>
                <button
                  onClick={() => setIsPrivate(true)}
                  className={`flex-1 px-3 py-2 text-sm rounded ${isPrivate ? 'bg-[var(--mc-accent)] text-[var(--mc-bg-primary)]' : 'bg-[var(--mc-bg-hover)]'}`}
                >
                  Private
                </button>
              </div>
            </div>
          </div>
        )}

        {view === 'link' && (
          <div className="space-y-4">
            <div>
              <label className="text-xs text-[var(--mc-text-muted)] block mb-1">Repository</label>
              <input
                value={repoPath}
                onChange={(e) => {
                  setRepoPath(e.target.value)
                  validateRepoPath(e.target.value)
                }}
                placeholder="username/repository"
                className={`w-full px-3 py-2 bg-[var(--mc-bg-primary)] border rounded focus:outline-none ${
                  validationStatus === 'valid' ? 'border-green-500' :
                  validationStatus === 'invalid' ? 'border-red-500' :
                  'border-[var(--mc-border)] focus:border-[var(--mc-accent)]'
                }`}
              />
              <p className="text-xs text-[var(--mc-text-muted)] mt-1">
                Enter the full repository path (e.g., octocat/hello-world)
              </p>
              {validating && <p className="text-xs text-[var(--mc-text-muted)] mt-1">Validating...</p>}
              {validationStatus === 'valid' && <p className="text-xs text-green-400 mt-1">Repository found</p>}
              {validationStatus === 'invalid' && <p className="text-xs text-red-400 mt-1">Repository not found</p>}
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="px-4 py-3 border-t border-[var(--mc-border)] flex items-center justify-between">
        <label className="flex items-center gap-2 text-xs text-[var(--mc-text-muted)]">
          <input
            type="checkbox"
            checked={dontAskAgain}
            onChange={(e) => setDontAskAgain(e.target.checked)}
          />
          Don't ask again
        </label>
        <div className="flex gap-2">
          {view === 'options' && (
            <button
              onClick={handleRetryDetection}
              className="px-3 py-1.5 text-xs text-[var(--mc-text-muted)] hover:text-[var(--mc-text-primary)]"
            >
              Retry Detection
            </button>
          )}
          <button
            onClick={() => onSkip(dontAskAgain)}
            className="px-3 py-1.5 text-xs bg-[var(--mc-bg-hover)] rounded hover:bg-[var(--mc-bg-active)]"
          >
            Skip for now
          </button>
          {view === 'create' && (
            <button
              onClick={handleCreate}
              disabled={!repoName || creating}
              className="px-3 py-1.5 text-xs bg-[var(--mc-accent)] text-[var(--mc-bg-primary)] rounded hover:opacity-90 disabled:opacity-50"
            >
              {creating ? 'Creating...' : 'Create Repository'}
            </button>
          )}
          {view === 'link' && (
            <button
              onClick={handleLink}
              disabled={validationStatus !== 'valid' || linking}
              className="px-3 py-1.5 text-xs bg-[var(--mc-accent)] text-[var(--mc-bg-primary)] rounded hover:opacity-90 disabled:opacity-50"
            >
              {linking ? 'Linking...' : 'Link Repository'}
            </button>
          )}
        </div>
      </div>
    </>
  )
}
```

### 5. Create Index Export

**File:** `index.ts`

```typescript
export { GitHubConnectionModal } from './github-connection-modal'
```

---

## Todo List

- [ ] Create github-connection-modal directory
- [ ] Create github-connection-modal.tsx
- [ ] Create auth-step.tsx with polling
- [ ] Create configure-step.tsx with forms
- [ ] Add icon components
- [ ] Implement validation for link form
- [ ] Add loading states
- [ ] Create index.ts export
- [ ] Test component in isolation

---

## Success Criteria

- [ ] Auth step shows when not authenticated
- [ ] Auth step polls for completion
- [ ] Configure step shows when authenticated
- [ ] Create form auto-fills repo name
- [ ] Link form validates repo path
- [ ] Loading states show during operations
- [ ] Step indicator updates correctly
- [ ] Keyboard navigation works

---

## Notes

- Keep main modal component minimal (~200 LOC)
- Split auth and configure into separate files
- Reuse toast system for feedback
- Match existing modal styling patterns
