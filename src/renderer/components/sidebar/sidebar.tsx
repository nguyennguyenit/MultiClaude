import { useState, useEffect } from 'react'
import { useAppStore } from '../../stores'
import { SettingsPanel } from '../settings'
import type { GitStatus, GitHubAuth } from '@shared/types'

// Toggle switch component for YOLO mode
function YoloToggle({ enabled, onChange, disabled }: { enabled: boolean; onChange: (enabled: boolean) => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      onClick={() => !disabled && onChange(!enabled)}
      disabled={disabled}
      className={`
        relative inline-flex h-5 w-9 items-center rounded-full transition-colors
        ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
        ${enabled ? 'bg-orange-500' : 'bg-[var(--mc-bg-tertiary)]'}
      `}
      role="switch"
      aria-checked={enabled}
    >
      <span
        className={`
          inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform
          ${enabled ? 'translate-x-4.5' : 'translate-x-1'}
        `}
        style={{ transform: enabled ? 'translateX(18px)' : 'translateX(4px)' }}
      />
    </button>
  )
}

export function Sidebar() {
  const {
    activeProjectId,
    activeTerminalId,
    terminals,
    sidebarOpen,
    addTerminal,
    removeTerminal,
    projects
  } = useAppStore()

  const [gitStatus, setGitStatus] = useState<GitStatus | null>(null)
  const [githubAuth, setGithubAuth] = useState<GitHubAuth | null>(null)
  const [newRepoName, setNewRepoName] = useState('')
  const [isPrivate, setIsPrivate] = useState(false)
  const [showGitModal, setShowGitModal] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)
  const [isCreating, setIsCreating] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [yoloEnabled, setYoloEnabled] = useState(false)

  const activeProject = projects.find(p => p.id === activeProjectId)

  // Load git status when active project changes
  useEffect(() => {
    if (activeProject) {
      window.electron.git.status(activeProject.path).then(setGitStatus)
    } else {
      setGitStatus(null)
    }
  }, [activeProject])

  // Load YOLO mode status when active project changes
  useEffect(() => {
    if (activeProject) {
      window.electron.yolo.get(activeProject.path).then(setYoloEnabled)
    } else {
      setYoloEnabled(false)
    }
  }, [activeProject])

  // Load GitHub auth status
  useEffect(() => {
    window.electron.github.authStatus().then(setGithubAuth)
  }, [])

  // Tools handlers
  const handleAddTerminal = async () => {
    const terminal = await window.electron.terminal.create({
      cwd: activeProject?.path,
      projectId: activeProject?.id
    })
    addTerminal(terminal)
  }

  const handleStartClaude = async () => {
    if (!activeTerminalId) return
    await window.electron.terminal.invokeClaude(activeTerminalId)
  }

  const handleYoloToggle = async (enabled: boolean) => {
    if (!activeProject) return
    const result = await window.electron.yolo.set(activeProject.path, enabled)
    if (result.success) {
      setYoloEnabled(enabled)
    }
  }

  const handleKillAll = async () => {
    // Kill all terminals for active project (or all if no project selected)
    const terminalsToKill = activeProjectId
      ? terminals.filter(t => t.projectId === activeProjectId)
      : terminals

    for (const terminal of terminalsToKill) {
      await window.electron.terminal.destroy(terminal.id)
      removeTerminal(terminal.id)
    }
  }

  const handleInitGit = async () => {
    if (!activeProject) return
    const success = await window.electron.git.init(activeProject.path)
    if (success) {
      const status = await window.electron.git.status(activeProject.path)
      setGitStatus(status)
    }
  }

  const handleGitHubLogin = async () => {
    await window.electron.github.login()
    // Refresh auth status after login
    setTimeout(async () => {
      const auth = await window.electron.github.authStatus()
      setGithubAuth(auth)
    }, 5000)
  }

  const handleCreateRepo = async () => {
    if (!activeProject || !newRepoName) return
    setIsCreating(true)
    setCreateError(null)
    const result = await window.electron.github.createRepo(newRepoName, isPrivate, activeProject.path)
    setIsCreating(false)
    if (result.success) {
      setShowGitModal(false)
      setNewRepoName('')
      const status = await window.electron.git.status(activeProject.path)
      setGitStatus(status)
    } else {
      setCreateError(result.error || 'Failed to create repository')
    }
  }

  if (!sidebarOpen) return null

  const projectTerminalCount = activeProjectId
    ? terminals.filter(t => t.projectId === activeProjectId).length
    : terminals.length

  return (
    <div className="w-64 bg-[var(--mc-bg-secondary)] border-r border-[var(--mc-border)] flex flex-col h-full">
      {/* Features Section */}
      <div className="flex-1 overflow-y-auto">
        <div className="px-4 py-2 text-xs text-[var(--mc-text-muted)] uppercase">
          Features
        </div>

        {/* Git Section */}
        <div className="px-3 py-2 border-b border-[var(--mc-border)]">
          <div className="flex items-center gap-2 mb-2">
            <svg className="w-4 h-4 text-[var(--mc-accent)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
            </svg>
            <span className="text-sm font-medium">Git</span>
          </div>

          {activeProject ? (
            <>
              {gitStatus?.isRepo ? (
                <div className="space-y-1 text-xs">
                  <div className="flex items-center gap-2">
                    <span className="text-[var(--mc-text-muted)]">Branch:</span>
                    <span className="text-green-400">{gitStatus.branch}</span>
                  </div>
                  {gitStatus.isDirty && (
                    <div className="text-yellow-400">
                      {gitStatus.staged + gitStatus.unstaged + gitStatus.untracked} changes
                    </div>
                  )}
                </div>
              ) : (
                <button
                  onClick={handleInitGit}
                  className="w-full px-2 py-1 text-xs bg-[var(--mc-bg-hover)] hover:bg-[var(--mc-bg-active)] rounded"
                >
                  Initialize Git
                </button>
              )}
            </>
          ) : (
            <div className="text-xs text-[var(--mc-text-muted)]">No project selected</div>
          )}
        </div>

        {/* GitHub Section */}
        <div className="px-3 py-2 border-b border-[var(--mc-border)]">
          <div className="flex items-center gap-2 mb-2">
            <svg className="w-4 h-4 text-[var(--mc-accent)]" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z"/>
            </svg>
            <span className="text-sm font-medium">GitHub</span>
          </div>

          {githubAuth?.isAuthenticated ? (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-xs">
                <span className="w-2 h-2 bg-green-400 rounded-full"></span>
                <span>@{githubAuth.username}</span>
              </div>
              {activeProject && gitStatus?.isRepo && !gitStatus?.hasRemote && (
                <button
                  onClick={() => setShowGitModal(true)}
                  className="w-full px-2 py-1 text-xs bg-[var(--mc-accent)] text-[var(--mc-bg-primary)] hover:opacity-90 rounded"
                >
                  Connect to GitHub
                </button>
              )}
              {gitStatus?.hasRemote && (
                <div className="text-xs text-[var(--mc-text-muted)] truncate">
                  {gitStatus.remoteUrl}
                </div>
              )}
            </div>
          ) : (
            <button
              onClick={handleGitHubLogin}
              className="w-full px-2 py-1 text-xs bg-[var(--mc-bg-tertiary)] hover:bg-[var(--mc-bg-hover)] rounded flex items-center justify-center gap-2"
            >
              Login to GitHub
            </button>
          )}
        </div>

        {/* Tools Section */}
        <div className="px-3 py-2">
          <div className="flex items-center gap-2 mb-2">
            <svg className="w-4 h-4 text-[var(--mc-accent)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            <span className="text-sm font-medium">Tools</span>
          </div>

          <div className="space-y-1">
            {/* New Terminal */}
            <button
              onClick={handleAddTerminal}
              className="w-full flex items-center gap-2 px-2 py-1.5 text-sm hover:bg-[var(--mc-bg-hover)] rounded text-left"
            >
              <svg className="w-4 h-4 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              <span>New Terminal</span>
            </button>

            {/* YOLO Mode Toggle */}
            <div
              className={`w-full flex items-center justify-between px-2 py-1.5 text-sm rounded ${!activeProject ? 'opacity-50' : ''}`}
            >
              <div className="flex items-center gap-2">
                <svg className={`w-4 h-4 ${yoloEnabled ? 'text-orange-500' : 'text-[var(--mc-text-muted)]'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
                <span className={yoloEnabled ? 'text-orange-500' : ''}>YOLO Mode</span>
              </div>
              <YoloToggle
                enabled={yoloEnabled}
                onChange={handleYoloToggle}
                disabled={!activeProject}
              />
            </div>

            {/* Start Claude */}
            <button
              onClick={handleStartClaude}
              disabled={!activeTerminalId}
              className="w-full flex items-center gap-2 px-2 py-1.5 text-sm hover:bg-[var(--mc-bg-hover)] disabled:opacity-50 disabled:cursor-not-allowed rounded text-left"
            >
              <svg className="w-4 h-4 text-[var(--mc-accent)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span>Start Claude</span>
            </button>

            {/* Kill All */}
            <button
              onClick={handleKillAll}
              disabled={projectTerminalCount === 0}
              className="w-full flex items-center gap-2 px-2 py-1.5 text-sm hover:bg-[var(--mc-bg-hover)] disabled:opacity-50 disabled:cursor-not-allowed rounded text-left"
            >
              <svg className="w-4 h-4 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
              <span>Kill All ({projectTerminalCount})</span>
            </button>
          </div>
        </div>
      </div>

      {/* Git Modal */}
      {showGitModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-[var(--mc-bg-secondary)] rounded-lg p-4 w-80">
            <h3 className="text-lg font-semibold mb-4">Create GitHub Repository</h3>
            <input
              type="text"
              value={newRepoName}
              onChange={(e) => setNewRepoName(e.target.value)}
              placeholder="Repository name"
              className="w-full px-3 py-2 bg-[var(--mc-bg-hover)] rounded mb-3 text-sm"
              disabled={isCreating}
            />
            <label className="flex items-center gap-2 mb-3 text-sm">
              <input
                type="checkbox"
                checked={isPrivate}
                onChange={(e) => setIsPrivate(e.target.checked)}
                className="rounded"
                disabled={isCreating}
              />
              Private repository
            </label>
            {createError && (
              <div className="mb-3 p-2 bg-red-900/50 border border-red-700 rounded text-xs text-red-300">
                {createError}
              </div>
            )}
            <div className="flex gap-2">
              <button
                onClick={() => {
                  setShowGitModal(false)
                  setCreateError(null)
                }}
                className="flex-1 px-3 py-1.5 text-sm bg-[var(--mc-bg-hover)] hover:bg-[var(--mc-bg-active)] rounded"
                disabled={isCreating}
              >
                Cancel
              </button>
              <button
                onClick={handleCreateRepo}
                disabled={!newRepoName || isCreating}
                className="flex-1 px-3 py-1.5 text-sm bg-[var(--mc-accent)] text-[var(--mc-bg-primary)] hover:opacity-90 disabled:opacity-50 rounded"
              >
                {isCreating ? 'Creating...' : 'Create'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Settings Section - Bottom */}
      <div className="mt-auto">
        {showSettings && (
          <SettingsPanel onClose={() => setShowSettings(false)} />
        )}
        <div className="border-t border-[var(--mc-border)] p-2">
          <button
            onClick={() => setShowSettings(!showSettings)}
            className={`
              w-full flex items-center gap-2 px-2 py-2 rounded text-sm
              ${showSettings
                ? 'bg-[var(--mc-bg-active)] text-[var(--mc-accent)]'
                : 'hover:bg-[var(--mc-bg-hover)] text-[var(--mc-text-secondary)]'
              }
            `}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            <span>Settings</span>
          </button>
        </div>
      </div>
    </div>
  )
}
