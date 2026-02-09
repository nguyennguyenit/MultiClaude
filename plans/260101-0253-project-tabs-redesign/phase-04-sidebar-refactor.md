# Phase 4: Sidebar Refactor

**Status:** ✅ COMPLETE
**Review:** plans/reports/code-reviewer-260101-1114-phase4-sidebar.md

## Objective
Remove projects from sidebar, add Tools section.

## Files to Modify

### 1. `src/renderer/components/sidebar/sidebar.tsx`

Replace entire file:

```typescript
import { useState, useEffect } from 'react'
import { useAppStore } from '../../stores'
import { SettingsPanel } from '../settings'
import type { GitStatus, GitHubAuth } from '@shared/types'

export function Sidebar() {
  const {
    projects,
    activeProjectId,
    terminals,
    activeTerminalId,
    sidebarOpen
  } = useAppStore()

  const [gitStatus, setGitStatus] = useState<GitStatus | null>(null)
  const [githubAuth, setGithubAuth] = useState<GitHubAuth | null>(null)
  const [showGitModal, setShowGitModal] = useState(false)
  const [newRepoName, setNewRepoName] = useState('')
  const [isPrivate, setIsPrivate] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)
  const [isCreating, setIsCreating] = useState(false)
  const [showSettings, setShowSettings] = useState(false)

  const activeProject = projects.find(p => p.id === activeProjectId)
  const activeTerminal = terminals.find(t => t.id === activeTerminalId)

  // Load git status when active project changes
  useEffect(() => {
    if (activeProject) {
      window.electron.git.status(activeProject.path).then(setGitStatus)
    } else {
      setGitStatus(null)
    }
  }, [activeProject])

  // Load GitHub auth status
  useEffect(() => {
    window.electron.github.authStatus().then(setGithubAuth)
  }, [])

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

  // Tools handlers
  const handleNewTerminal = async () => {
    if (!activeProject) return
    const terminal = await window.electron.terminal.create({
      cwd: activeProject.path,
      projectId: activeProject.id
    })
    useAppStore.getState().addTerminal(terminal)
    useAppStore.getState().addTerminalToProject(activeProject.id, terminal.id, terminal.title)
  }

  const handleStartClaude = async () => {
    if (!activeTerminalId) return
    await window.electron.terminal.invokeClaude(activeTerminalId)
  }

  const handleKillAll = async () => {
    if (!activeProject) return
    const layout = useAppStore.getState().projectTerminals[activeProject.id]
    if (!layout) return
    for (const t of layout.terminals) {
      await window.electron.terminal.destroy(t.id)
      useAppStore.getState().removeTerminal(t.id)
    }
    useAppStore.getState().setProjectTerminalLayout(activeProject.id, {
      projectId: activeProject.id,
      terminals: []
    })
  }

  if (!sidebarOpen) return null

  return (
    <div className="w-56 bg-[var(--mc-bg-secondary)] border-r border-[var(--mc-border)] flex flex-col h-full">
      {/* Features Header */}
      <div className="px-4 py-2 text-xs text-[var(--mc-text-muted)] uppercase">
        Features
      </div>

      <div className="flex-1 overflow-y-auto">
        {/* Git Section */}
        <div className="px-3 py-2 border-b border-[var(--mc-border)]">
          <div className="flex items-center gap-2 mb-2">
            <svg className="w-4 h-4 text-orange-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
            </svg>
            <span className="text-sm font-medium">Git</span>
          </div>

          {activeProject ? (
            <>
              {gitStatus?.isRepo ? (
                <div className="space-y-1.5 text-sm">
                  <div className="flex items-center gap-2">
                    <span className="text-green-400 text-xs">●</span>
                    <span>{gitStatus.branch}</span>
                  </div>
                  {gitStatus.isDirty && (
                    <div className="text-xs text-[var(--mc-text-muted)]">
                      {gitStatus.staged}↑ {gitStatus.unstaged}~ {gitStatus.untracked}?
                    </div>
                  )}
                  {!gitStatus.hasRemote && (
                    <button
                      onClick={() => setShowGitModal(true)}
                      className="w-full mt-2 px-2 py-1 text-xs bg-[var(--mc-accent)] text-[var(--mc-bg-primary)] rounded"
                    >
                      Connect GitHub
                    </button>
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
            <div className="text-xs text-[var(--mc-text-muted)]">Select a project</div>
          )}
        </div>

        {/* GitHub Section */}
        <div className="px-3 py-2 border-b border-[var(--mc-border)]">
          <div className="flex items-center gap-2 mb-2">
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z"/>
            </svg>
            <span className="text-sm font-medium">GitHub</span>
          </div>

          {githubAuth?.isAuthenticated ? (
            <div className="flex items-center gap-2 text-sm">
              <span className="w-2 h-2 bg-green-400 rounded-full"></span>
              <span>@{githubAuth.username}</span>
            </div>
          ) : (
            <button
              onClick={handleGitHubLogin}
              className="w-full px-2 py-1 text-xs bg-[var(--mc-bg-hover)] hover:bg-[var(--mc-bg-active)] rounded"
            >
              Login to GitHub
            </button>
          )}
        </div>

        {/* Tools Section */}
        <div className="px-3 py-2">
          <div className="flex items-center gap-2 mb-2">
            <svg className="w-4 h-4 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            <span className="text-sm font-medium">Tools</span>
          </div>

          <div className="space-y-1">
            <button
              onClick={handleNewTerminal}
              disabled={!activeProject}
              className="w-full flex items-center gap-2 px-2 py-1.5 text-sm hover:bg-[var(--mc-bg-hover)] disabled:opacity-50 rounded"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              <span>New Terminal</span>
              <span className="ml-auto text-xs text-[var(--mc-text-muted)]">Ctrl+N</span>
            </button>

            <button
              onClick={handleStartClaude}
              disabled={!activeTerminalId || activeTerminal?.isClaudeMode}
              className="w-full flex items-center gap-2 px-2 py-1.5 text-sm hover:bg-[var(--mc-bg-hover)] disabled:opacity-50 rounded"
            >
              <svg className="w-4 h-4 text-[var(--mc-accent)]" fill="currentColor" viewBox="0 0 24 24">
                <path d="M8 5v14l11-7z" />
              </svg>
              <span>Start Claude</span>
            </button>

            <button
              onClick={handleKillAll}
              disabled={!activeProject}
              className="w-full flex items-center gap-2 px-2 py-1.5 text-sm hover:bg-[var(--mc-bg-hover)] disabled:opacity-50 rounded text-red-400"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
              <span>Kill All Terminals</span>
            </button>
          </div>
        </div>
      </div>

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

      {/* Git Modal (keep existing) */}
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
                onClick={() => { setShowGitModal(false); setCreateError(null) }}
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
    </div>
  )
}
```

## Visual Reference

```
┌──────────────┐
│ FEATURES     │
│ ─────────────│
│ 📂 Git       │
│   ● master   │
│   2↑ 3~ 1?   │
│ ─────────────│
│ 🐙 GitHub    │
│   @username  │
│ ─────────────│
│ 🔧 Tools     │
│   + Terminal │
│   ▶ Claude   │
│   ✕ Kill All │
├──────────────┤
│ ⚙ Settings   │
└──────────────┘
```

## Validation

After implementation:
1. ✅ Projects section removed
2. ✅ Git section shows status
3. ✅ GitHub section shows auth
4. ✅ Tools section buttons work (New Terminal, Start Claude, Kill All)
5. ✅ Settings still works

## Implementation Notes

Actual implementation deviates from spec in beneficial ways:

1. **Store Usage Pattern:** Uses destructured methods from `useAppStore()` instead of `getState()` calls (idiomatic Zustand pattern)
2. **Kill All Logic:** Filters terminals by `projectId` directly instead of traversing projectTerminals layout (simpler, KISS-compliant)
3. **Terminal Addition:** Uses `addTerminal()` without separate `addTerminalToProject()` call (method doesn't exist, projectId property sufficient)
4. **Width:** Sidebar is `w-64` not `w-56` (better spacing)

All deviations reviewed and approved - implementation superior to spec. See code-reviewer-260101-1114-phase4-sidebar.md for details.
