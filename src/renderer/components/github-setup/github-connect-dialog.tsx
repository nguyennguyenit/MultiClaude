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
    } catch (err) {
      setError('Failed to check git status')
    } finally {
      setIsLoading(false)
    }
  }

  const renderContent = () => {
    switch (view) {
      case 'options':
        return (
          <>
            {/* Options */}
            <div className="grid grid-cols-2 gap-3 mb-4">
              <button
                onClick={() => setView('create')}
                className="p-4 border border-[var(--mc-border)] rounded-lg hover:border-[var(--mc-accent)] hover:bg-[var(--mc-bg-hover)] transition-colors text-left"
              >
                <div className="flex items-center gap-2 mb-2">
                  <PlusIcon />
                  <span className="font-medium text-sm">Create New Repo</span>
                </div>
                <p className="text-xs text-[var(--mc-text-muted)]">
                  Create a new GitHub repository
                </p>
              </button>

              <button
                onClick={() => setView('link')}
                className="p-4 border border-[var(--mc-border)] rounded-lg hover:border-[var(--mc-accent)] hover:bg-[var(--mc-bg-hover)] transition-colors text-left"
              >
                <div className="flex items-center gap-2 mb-2">
                  <LinkIcon />
                  <span className="font-medium text-sm">Link Existing</span>
                </div>
                <p className="text-xs text-[var(--mc-text-muted)]">
                  Connect to an existing repository
                </p>
              </button>
            </div>

            {/* Secondary Actions */}
            <div className="flex items-center gap-2 text-xs">
              <button
                onClick={handleSkip}
                className="text-[var(--mc-text-muted)] hover:text-[var(--mc-text-primary)] transition-colors"
              >
                Skip for now
              </button>
              <span className="text-[var(--mc-text-muted)]">•</span>
              <button
                onClick={handleRetry}
                disabled={isLoading}
                className="text-[var(--mc-text-muted)] hover:text-[var(--mc-text-primary)] transition-colors disabled:opacity-50"
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
              onClick={() => setView('options')}
              className="flex items-center gap-1 text-xs text-[var(--mc-text-muted)] hover:text-[var(--mc-text-primary)] mb-4 transition-colors"
            >
              <BackIcon />
              Back to options
            </button>

            <div className="space-y-3 mb-4">
              <div>
                <label className="text-xs text-[var(--mc-text-muted)] block mb-1">
                  Repository Name
                </label>
                <input
                  type="text"
                  value={repoName}
                  onChange={(e) => setRepoName(e.target.value)}
                  placeholder="my-project"
                  className="w-full px-3 py-2 text-sm bg-[var(--mc-bg-primary)] border border-[var(--mc-border)] rounded focus:outline-none focus:ring-1 focus:ring-[var(--mc-accent)]"
                />
              </div>

              <div className="flex items-center gap-3">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    checked={isPrivate}
                    onChange={() => setIsPrivate(true)}
                    className="accent-[var(--mc-accent)]"
                  />
                  <span className="text-sm flex items-center gap-1">
                    <LockIcon />
                    Private
                  </span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    checked={!isPrivate}
                    onChange={() => setIsPrivate(false)}
                    className="accent-[var(--mc-accent)]"
                  />
                  <span className="text-sm flex items-center gap-1">
                    <GlobeIcon />
                    Public
                  </span>
                </label>
              </div>
            </div>

            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setView('options')}
                className="px-4 py-2 text-sm bg-[var(--mc-bg-hover)] rounded hover:bg-[var(--mc-bg-active)] transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateRepo}
                disabled={isLoading || !repoName.trim()}
                className="px-4 py-2 text-sm bg-[var(--mc-accent)] text-[var(--mc-bg-primary)] rounded hover:opacity-90 disabled:opacity-50 flex items-center gap-2 transition-opacity"
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
              onClick={() => setView('options')}
              className="flex items-center gap-1 text-xs text-[var(--mc-text-muted)] hover:text-[var(--mc-text-primary)] mb-4 transition-colors"
            >
              <BackIcon />
              Back to options
            </button>

            <div className="space-y-3 mb-4">
              <div>
                <label className="text-xs text-[var(--mc-text-muted)] block mb-1">
                  Repository URL
                </label>
                <input
                  type="text"
                  value={repoUrl}
                  onChange={(e) => setRepoUrl(e.target.value)}
                  placeholder="https://github.com/username/repo.git"
                  className="w-full px-3 py-2 text-sm bg-[var(--mc-bg-primary)] border border-[var(--mc-border)] rounded focus:outline-none focus:ring-1 focus:ring-[var(--mc-accent)]"
                />
              </div>
            </div>

            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setView('options')}
                className="px-4 py-2 text-sm bg-[var(--mc-bg-hover)] rounded hover:bg-[var(--mc-bg-active)] transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleLinkRepo}
                disabled={isLoading || !repoUrl.trim()}
                className="px-4 py-2 text-sm bg-[var(--mc-accent)] text-[var(--mc-bg-primary)] rounded hover:opacity-90 disabled:opacity-50 flex items-center gap-2 transition-opacity"
              >
                {isLoading ? <SpinnerIcon /> : <LinkIcon />}
                {isLoading ? 'Linking...' : 'Link Repository'}
              </button>
            </div>
          </>
        )

      case 'branch-select':
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
              <label className="text-xs text-[var(--mc-text-muted)] block mb-1">Base Branch</label>
              <select
                value={selectedBranch}
                onChange={(e) => setSelectedBranch(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-[var(--mc-bg-primary)] border border-[var(--mc-border)] rounded focus:outline-none focus:ring-1 focus:ring-[var(--mc-accent)]"
              >
                {branches.map((branch) => (
                  <option key={branch.name} value={branch.name}>
                    {branch.name} {branch.current ? '★ Recommended' : ''}
                  </option>
                ))}
              </select>
            </div>

            {/* Info text */}
            <p className="text-xs text-[var(--mc-text-muted)] mb-3">
              Your code will be pushed to <code className="px-1 py-0.5 bg-[var(--mc-bg-primary)] rounded text-[var(--mc-accent)]">{connectedRepoName}/{selectedBranch}</code>
            </p>

            {/* Collapsible "Why push?" section */}
            <div className="mb-4 p-3 bg-[var(--mc-bg-primary)] rounded border border-[var(--mc-border)]">
              <button
                onClick={() => setShowWhyBranch(!showWhyBranch)}
                className="flex items-center gap-1 text-xs text-[var(--mc-text-muted)] hover:text-[var(--mc-text-primary)] w-full text-left"
              >
                <InfoIcon />
                Why push to remote?
                <ChevronIcon expanded={showWhyBranch} />
              </button>
              {showWhyBranch && (
                <p className="text-xs text-[var(--mc-text-muted)] mt-2 leading-relaxed">
                  Pushing your code to GitHub enables collaboration, backup, and version control.
                  This creates a remote copy of your work that can be accessed from anywhere.
                </p>
              )}
            </div>

            {/* Actions */}
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => onComplete(pendingAction, dontAskAgain)}
                className="px-4 py-2 text-sm bg-[var(--mc-bg-hover)] rounded hover:bg-[var(--mc-bg-active)] transition-colors"
              >
                Skip for now
              </button>
              <button
                onClick={handlePushBranch}
                disabled={isLoading || !selectedBranch}
                className="px-4 py-2 text-sm bg-[var(--mc-accent)] text-[var(--mc-bg-primary)] rounded hover:opacity-90 disabled:opacity-50 flex items-center gap-2 transition-opacity"
              >
                {isLoading ? <SpinnerIcon /> : <CheckCircleIcon small />}
                {isLoading ? 'Pushing...' : 'Complete Setup'}
              </button>
            </div>
          </>
        )
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-[var(--mc-bg-secondary)] rounded-lg p-5 w-[420px] max-w-[90vw] shadow-xl border border-[var(--mc-border)]">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <GitHubIcon />
            <h3 className="text-base font-medium text-[var(--mc-text-primary)]">
              Connect to GitHub
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 hover:bg-[var(--mc-bg-hover)] rounded transition-colors"
          >
            <CloseIcon />
          </button>
        </div>

        {/* Error message */}
        {error && (
          <div className="flex items-start gap-2 p-3 bg-red-500/10 border border-red-500/30 rounded mb-4">
            <ErrorIcon />
            <p className="text-sm text-red-400">{error}</p>
          </div>
        )}

        {/* Content */}
        {renderContent()}

        {/* Don't ask again checkbox - only show on options view */}
        {view === 'options' && (
          <label className="flex items-center gap-2 mt-4 cursor-pointer">
            <input
              type="checkbox"
              checked={dontAskAgain}
              onChange={(e) => setDontAskAgain(e.target.checked)}
              className="w-4 h-4 rounded border-[var(--mc-border)] bg-[var(--mc-bg-primary)] accent-[var(--mc-accent)]"
            />
            <span className="text-xs text-[var(--mc-text-muted)]">
              Don't ask again for this project
            </span>
          </label>
        )}
      </div>
    </div>
  )
}

// Icons
function GitHubIcon() {
  return (
    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
      <path fillRule="evenodd" clipRule="evenodd"
        d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" />
    </svg>
  )
}

function CloseIcon() {
  return (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
    </svg>
  )
}

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

function UploadIcon() {
  return (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
    </svg>
  )
}

function ErrorIcon() {
  return (
    <svg className="w-5 h-5 text-red-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
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
