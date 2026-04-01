import { useState, useEffect } from 'react'
import type { GitBranch } from '@shared/types'

type ViewState = 'options' | 'create' | 'link' | 'branch-select'

interface GitHubConnectDialogProps {
  isOpen: boolean
  projectName: string
  projectPath: string
  onComplete: (action: 'created' | 'linked' | 'skipped', dontAskAgain: boolean) => void
  onClose: () => void
}

export function GitHubConnectDialog({
  isOpen,
  projectName,
  projectPath,
  onComplete,
  onClose
}: GitHubConnectDialogProps) {
  const [view, setView] = useState<ViewState>('options')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [dontAskAgain, setDontAskAgain] = useState(false)

  // Create new repo state
  const [repoName, setRepoName] = useState(projectName)
  const [isPrivate, setIsPrivate] = useState(true)

  // Link existing repo state
  const [repoUrl, setRepoUrl] = useState('')

  // Branch selection state
  const [branches, setBranches] = useState<GitBranch[]>([])
  const [selectedBranch, setSelectedBranch] = useState('')
  const [pendingAction, setPendingAction] = useState<'created' | 'linked'>('created')
  const [connectedRepoName, setConnectedRepoName] = useState('')
  const [showWhyBranch, setShowWhyBranch] = useState(false)

  // Reset state when dialog opens
  useEffect(() => {
    if (isOpen) {
      setView('options')
      setError(null)
      setRepoName(projectName)
      setIsPrivate(true)
      setRepoUrl('')
      setDontAskAgain(false)
    }
  }, [isOpen, projectName])

  if (!isOpen) return null

  const handleCreateRepo = async () => {
    if (!repoName.trim()) {
      setError('Repository name is required')
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      const result = await window.electron.github.createRepo(repoName, isPrivate, projectPath)
      if (!result.success) {
        setError(result.error || 'Failed to create repository')
        return
      }

      // Get current branch from git status (more reliable than branches list for fresh repos)
      const status = await window.electron.git.status(projectPath)
      const currentBranch = status.branch || 'main'

      // Load branches for selection
      const branchList = await window.electron.git.branches(projectPath)
      const localBranches = branchList.filter(b => !b.isRemote)

      // If no branches found, create a synthetic entry for current branch
      if (localBranches.length === 0) {
        setBranches([{ name: currentBranch, current: true, commit: '', label: currentBranch, isRemote: false }])
      } else {
        setBranches(localBranches)
      }
      setSelectedBranch(currentBranch)
      setConnectedRepoName(repoName)
      setPendingAction('created')
      setView('branch-select')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create repository')
    } finally {
      setIsLoading(false)
    }
  }

  const handleLinkRepo = async () => {
    if (!repoUrl.trim()) {
      setError('Repository URL is required')
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      const success = await window.electron.git.addRemote(projectPath, repoUrl, 'origin')
      if (!success) {
        setError('Failed to add remote. Check the URL and try again.')
        return
      }

      // Fetch remote branches
      await window.electron.git.fetch(projectPath)

      // Get current branch from git status
      const status = await window.electron.git.status(projectPath)
      const currentBranch = status.branch || 'main'

      // Load branches for selection
      const branchList = await window.electron.git.branches(projectPath)
      const localBranches = branchList.filter(b => !b.isRemote)

      if (localBranches.length === 0) {
        setBranches([{ name: currentBranch, current: true, commit: '', label: currentBranch, isRemote: false }])
      } else {
        setBranches(localBranches)
      }
      setSelectedBranch(currentBranch)
      // Extract repo name from URL
      const repoMatch = repoUrl.match(/\/([^/]+?)(?:\.git)?$/)
      setConnectedRepoName(repoMatch?.[1] || projectName)
      setPendingAction('linked')
      setView('branch-select')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to link repository')
    } finally {
      setIsLoading(false)
    }
  }

  const handlePushBranch = async () => {
    setIsLoading(true)
    setError(null)

    try {
      const result = await window.electron.git.push(projectPath, selectedBranch, true)
      if (!result.success) {
        setError(result.error || 'Failed to push to remote')
        return
      }
      onComplete(pendingAction, dontAskAgain)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to push')
    } finally {
      setIsLoading(false)
    }
  }

  const handleSkip = () => {
    onComplete('skipped', dontAskAgain)
  }

  const handleRetry = async () => {
    setIsLoading(true)
    setError(null)

    try {
      const status = await window.electron.git.status(projectPath)
      if (status.hasRemote) {
        onComplete('linked', dontAskAgain)
      } else {
        setError('No remote detected. Please add a remote manually or use the options above.')
      }
    } catch {
      setError('Failed to check git status')
    } finally {
      setIsLoading(false)
    }
  }

  const isOptionsView = view === 'options'

  const renderContent = () => {
    switch (view) {
      case 'options':
        return (
          <>
            <div className="github-connect-hero">
              <div className="github-connect-hero-icon" aria-hidden="true">
                <RepoIcon />
              </div>
              <div className="github-connect-hero-copy">
                <span className="github-connect-hero-kicker">Choose a setup path</span>
                <h3 className="github-connect-hero-title">Connect {projectName || 'this project'} to GitHub</h3>
                <p className="github-connect-hero-text">
                  Create a new repository or link an existing one without changing your local files.
                </p>
              </div>
            </div>

            <div className="github-connect-project-card">
              <span className="github-connect-project-label">Local project</span>
              <span className="github-connect-project-name">{projectName || 'Current project'}</span>
              <code className="github-connect-project-path">{projectPath}</code>
            </div>

            <div className="github-connect-option-grid">
              <button
                onClick={() => setView('create')}
                className="github-connect-option-card"
              >
                <span className="github-connect-option-icon" aria-hidden="true"><PlusIcon /></span>
                <div className="github-connect-option-copy">
                  <span className="github-connect-option-title">Create New Repo</span>
                  <p className="github-connect-option-text">
                    Publish this folder as a brand-new GitHub repository.
                  </p>
                </div>
              </button>

              <button
                onClick={() => setView('link')}
                className="github-connect-option-card"
              >
                <span className="github-connect-option-icon" aria-hidden="true"><LinkIcon /></span>
                <div className="github-connect-option-copy">
                  <span className="github-connect-option-title">Link Existing</span>
                  <p className="github-connect-option-text">
                    Connect this folder to a repository that already exists on GitHub.
                  </p>
                </div>
              </button>
            </div>

            <div className="github-connect-secondary-actions">
              <button
                onClick={handleSkip}
                className="github-connect-secondary-btn"
              >
                Skip for now
              </button>
              <button
                onClick={handleRetry}
                disabled={isLoading}
                className="github-connect-secondary-btn"
              >
                {isLoading ? 'Checking...' : 'Retry Detection'}
              </button>
            </div>
          </>
        )

      case 'create':
        return (
          <>
            <button
              type="button"
              onClick={() => setView('options')}
              className="github-connect-back-btn"
            >
              <BackIcon />
              Back to options
            </button>

            <div className="github-connect-form-shell">
              <div className="github-connect-form-intro">
                <span className="github-connect-form-kicker">Create remote</span>
                <h4 className="github-connect-form-title">Create a new GitHub repository for {projectName || 'this project'}</h4>
                <p className="github-connect-form-text">
                  We&apos;ll create a fresh repository on GitHub, then connect this local folder to it.
                </p>
              </div>

              <div className="github-connect-field-group">
                <label className="github-connect-field-label">
                  Repository Name
                </label>
                <input
                  type="text"
                  value={repoName}
                  onChange={(e) => setRepoName(e.target.value)}
                  placeholder="my-project"
                  className="github-connect-input"
                />
              </div>

              <div className="github-connect-radio-grid">
                <label className={`github-connect-radio-card${isPrivate ? ' is-selected' : ''}`}>
                  <input
                    type="radio"
                    checked={isPrivate}
                    onChange={() => setIsPrivate(true)}
                    className="github-connect-radio-input"
                  />
                  <span className="github-connect-radio-copy">
                    <span className="github-connect-radio-title">
                      <LockIcon />
                      Private
                    </span>
                    <span className="github-connect-radio-text">Visible only to you and invited collaborators.</span>
                  </span>
                </label>
                <label className={`github-connect-radio-card${!isPrivate ? ' is-selected' : ''}`}>
                  <input
                    type="radio"
                    checked={!isPrivate}
                    onChange={() => setIsPrivate(false)}
                    className="github-connect-radio-input"
                  />
                  <span className="github-connect-radio-copy">
                    <span className="github-connect-radio-title">
                      <GlobeIcon />
                      Public
                    </span>
                    <span className="github-connect-radio-text">Anyone can view the repository on GitHub.</span>
                  </span>
                </label>
              </div>
            </div>

            <div className="github-connect-actions">
              <button
                type="button"
                onClick={() => setView('options')}
                className="github-connect-action-btn"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleCreateRepo}
                disabled={isLoading || !repoName.trim()}
                className="github-connect-action-btn github-connect-action-btn-primary"
              >
                {isLoading ? <SpinnerIcon /> : <PlusIcon />}
                {isLoading ? 'Creating...' : 'Create Repository'}
              </button>
            </div>
          </>
        )

      case 'link':
        return (
          <>
            <button
              type="button"
              onClick={() => setView('options')}
              className="github-connect-back-btn"
            >
              <BackIcon />
              Back to options
            </button>

            <div className="github-connect-form-shell">
              <div className="github-connect-form-intro">
                <span className="github-connect-form-kicker">Link existing remote</span>
                <h4 className="github-connect-form-title">Attach this project to an existing GitHub repository</h4>
                <p className="github-connect-form-text">
                  Paste the repository URL and we&apos;ll connect this local folder as `origin`.
                </p>
              </div>

              <div className="github-connect-field-group">
                <label className="github-connect-field-label">
                  Repository URL
                </label>
                <input
                  type="text"
                  value={repoUrl}
                  onChange={(e) => setRepoUrl(e.target.value)}
                  placeholder="https://github.com/username/repo.git"
                  className="github-connect-input"
                />
              </div>
            </div>

            <div className="github-connect-actions">
              <button
                type="button"
                onClick={() => setView('options')}
                className="github-connect-action-btn"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleLinkRepo}
                disabled={isLoading || !repoUrl.trim()}
                className="github-connect-action-btn github-connect-action-btn-primary"
              >
                {isLoading ? <SpinnerIcon /> : <LinkIcon />}
                {isLoading ? 'Linking...' : 'Link Repository'}
              </button>
            </div>
          </>
        )

      case 'branch-select':
        {
          const hasSingleBranch = branches.length <= 1
          const activeBranchName = branches[0]?.name || selectedBranch || 'main'

        return (
          <>
            {/* Step indicator */}
            <div className="flex items-center justify-center gap-2 mb-4 text-xs">
              <span className="flex items-center gap-1 text-[var(--mc-accent)]">
                <CheckCircleIcon />
                Connect
              </span>
              <ChevronRightIcon />
              <span className="flex items-center gap-1.5">
                <span className="w-5 h-5 rounded-full bg-[var(--mc-accent)] text-[var(--mc-bg-primary)] flex items-center justify-center text-xs font-medium">2</span>
                Configure
              </span>
            </div>

            {/* Title */}
            <div className="mb-4">
              <h4 className="text-sm font-medium flex items-center gap-2 mb-1">
                <BranchIcon />
                Select Base Branch
              </h4>
              <p className="text-xs text-[var(--mc-text-muted)]">
                Choose which branch to push as the base for your repository.
              </p>
            </div>

            {/* Repository info */}
            <div className="flex items-center gap-2 text-xs text-[var(--mc-text-muted)] mb-3">
              <RepoIcon />
              Repository:
              <span className="px-2 py-0.5 bg-[var(--mc-bg-primary)] rounded text-[var(--mc-text-primary)] font-mono flex items-center gap-1">
                {connectedRepoName}
                <CheckCircleIcon small />
              </span>
            </div>

            {/* Branch selector */}
            <div className="mb-3">
              <label className="github-connect-field-label">Base Branch</label>
              {hasSingleBranch ? (
                <>
                  <div className="github-connect-branch-card">
                    <div className="github-connect-branch-card-main">
                      <span className="github-connect-branch-card-icon" aria-hidden="true">
                        <BranchIcon />
                      </span>
                      <div className="github-connect-branch-card-copy">
                        <span className="github-connect-branch-card-title">{activeBranchName}</span>
                        <span className="github-connect-branch-card-subtitle">Only local branch available</span>
                      </div>
                    </div>
                    <span className="github-connect-branch-card-badge">Ready to push</span>
                  </div>
                  <p className="github-connect-branch-helper">This repository currently exposes a single local branch for setup.</p>
                </>
              ) : (
                <select
                  value={selectedBranch}
                  onChange={(e) => setSelectedBranch(e.target.value)}
                  className="github-connect-branch-select"
                >
                  {branches.map((branch) => (
                    <option key={branch.name} value={branch.name}>
                      {branch.name} {branch.current ? '★ Recommended' : ''}
                    </option>
                  ))}
                </select>
              )}
            </div>

            {/* Info text */}
            <p className="text-xs text-[var(--mc-text-muted)] mb-3">
              Your code will be pushed to <code className="px-1 py-0.5 bg-[var(--mc-bg-primary)] rounded text-[var(--mc-accent)]">{connectedRepoName}/{selectedBranch}</code>
            </p>

            {/* Collapsible "Why push?" section */}
            <div className="github-connect-why-panel">
              <button
                type="button"
                onClick={() => setShowWhyBranch(!showWhyBranch)}
                className="github-connect-why-toggle"
              >
                <InfoIcon />
                Why push to remote?
                <ChevronIcon expanded={showWhyBranch} />
              </button>
              {showWhyBranch && (
                <p className="github-connect-why-copy">
                  Pushing your code to GitHub enables collaboration, backup, and version control.
                  This creates a remote copy of your work that can be accessed from anywhere.
                </p>
              )}
            </div>

            {/* Actions */}
            <div className="github-connect-actions">
              <button
                type="button"
                onClick={() => onComplete(pendingAction, dontAskAgain)}
                className="github-connect-action-btn"
              >
                Skip for now
              </button>
              <button
                type="button"
                onClick={handlePushBranch}
                disabled={isLoading || !selectedBranch}
                className="github-connect-action-btn github-connect-action-btn-primary"
              >
                {isLoading ? <SpinnerIcon /> : <CheckCircleIcon small />}
                {isLoading ? 'Pushing...' : 'Complete Setup'}
              </button>
            </div>
          </>
        )
        }
    }
  }

  return (
    <div className="dialog-backdrop">
      <div className="dialog github-connect-dialog" style={{ padding: '0' }}>
        <div className="dialog-header github-connect-dialog-header">
          <div className="github-connect-dialog-title-group">
            <span className="github-connect-dialog-kicker">GitHub Setup</span>
            <span className="github-connect-dialog-title">Connect to GitHub</span>
          </div>
          <button onClick={onClose} className="slide-panel-close" title="Close">×</button>
        </div>

        <div className={`dialog-body github-connect-dialog-body${isOptionsView ? ' github-connect-dialog-body-options' : ''}`}>
          {error && (
            <div className="github-connect-error">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ flexShrink: 0, marginTop: '1px' }}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span>{error}</span>
            </div>
          )}

          {renderContent()}

          {isOptionsView && (
            <div className="github-connect-preference">
              <label className="github-connect-checkbox">
                <input
                  type="checkbox"
                  checked={dontAskAgain}
                  onChange={(e) => setDontAskAgain(e.target.checked)}
                  style={{ accentColor: 'var(--accent)' }}
                />
                <span>Don&apos;t ask again for this project</span>
              </label>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// Icons
function PlusIcon() {
  return (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
    </svg>
  )
}

function LinkIcon() {
  return (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
    </svg>
  )
}

function BackIcon() {
  return (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
    </svg>
  )
}

function LockIcon() {
  return (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
    </svg>
  )
}

function GlobeIcon() {
  return (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  )
}

function SpinnerIcon() {
  return (
    <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
    </svg>
  )
}

function CheckCircleIcon({ small }: { small?: boolean }) {
  const size = small ? 'w-3.5 h-3.5' : 'w-4 h-4'
  return (
    <svg className={`${size} text-[var(--mc-accent)]`} fill="currentColor" viewBox="0 0 24 24">
      <path fillRule="evenodd" clipRule="evenodd"
        d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" />
    </svg>
  )
}

function ChevronRightIcon() {
  return (
    <svg className="w-4 h-4 text-[var(--mc-text-muted)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
    </svg>
  )
}

function BranchIcon() {
  return (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M7 7a2 2 0 104 0 2 2 0 00-4 0zm0 10a2 2 0 104 0 2 2 0 00-4 0zm10-4a2 2 0 104 0 2 2 0 00-4 0zM9 7v10m4-4h4" />
    </svg>
  )
}

function RepoIcon() {
  return (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
    </svg>
  )
}

function InfoIcon() {
  return (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  )
}

function ChevronIcon({ expanded }: { expanded: boolean }) {
  return (
    <svg
      className={`w-4 h-4 ml-auto transition-transform ${expanded ? 'rotate-180' : ''}`}
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
    >
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
    </svg>
  )
}
