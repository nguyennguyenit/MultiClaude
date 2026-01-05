import { useState, useEffect, useCallback } from 'react'
import type { GitHubAuth, GitStatus, GitConfig } from '@shared/types'

interface UserAccountCardProps {
  collapsed: boolean
  projectPath?: string
}

type ConnectionState = 'connected' | 'disconnected' | 'syncing' | 'error'

const STATUS_STYLES: Record<ConnectionState, { icon: string; color: string; text: string }> = {
  connected: { icon: '●', color: 'text-green-400', text: 'Connected' },
  disconnected: { icon: '○', color: 'text-gray-400', text: 'Not logged in' },
  syncing: { icon: '◐', color: 'text-amber-400', text: 'Syncing...' },
  error: { icon: '●', color: 'text-red-400', text: 'Error' }
}

const GIT_STATUS_STYLES = {
  connected: { icon: '●', color: 'text-green-400', text: 'Connected' },
  disconnected: { icon: '○', color: 'text-gray-400', text: 'No remote' }
}

export function UserAccountCard({ collapsed, projectPath }: UserAccountCardProps) {
  const [githubAuth, setGithubAuth] = useState<GitHubAuth | null>(null)
  const [gitStatus, setGitStatus] = useState<GitStatus | null>(null)
  const [connectionState, setConnectionState] = useState<ConnectionState>('disconnected')
  const [isLoggingOut, setIsLoggingOut] = useState(false)
  const [gitConfig, setGitConfig] = useState<GitConfig>({})
  const [isEditingConfig, setIsEditingConfig] = useState(false)
  const [editName, setEditName] = useState('')
  const [editEmail, setEditEmail] = useState('')
  const [isSavingConfig, setIsSavingConfig] = useState(false)
  const [isRefreshing, setIsRefreshing] = useState(false)

  // Reload GitHub auth status
  const reloadAuth = useCallback(async () => {
    try {
      setConnectionState('syncing')
      const auth = await window.electron.github.authStatus()
      setGithubAuth(auth)
      setConnectionState(auth.isAuthenticated ? 'connected' : 'disconnected')
    } catch {
      setConnectionState('error')
    }
  }, [])

  // Handle logout
  const handleLogout = useCallback(async (e: React.MouseEvent) => {
    e.stopPropagation()
    if (isLoggingOut) return

    setIsLoggingOut(true)
    try {
      await window.electron.github.logout()
      await reloadAuth()
    } catch {
      setConnectionState('error')
    } finally {
      setIsLoggingOut(false)
    }
  }, [isLoggingOut, reloadAuth])

  // Load git config
  const loadGitConfig = useCallback(async () => {
    try {
      const config = await window.electron.git.configGet()
      setGitConfig(config)
    } catch {
      // Ignore errors
    }
  }, [])

  // Start editing git config
  const handleStartEdit = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    setEditName(gitConfig.userName || '')
    setEditEmail(gitConfig.userEmail || '')
    setIsEditingConfig(true)
  }, [gitConfig])

  // Save git config
  const handleSaveConfig = useCallback(async (e: React.MouseEvent) => {
    e.stopPropagation()
    if (isSavingConfig) return

    setIsSavingConfig(true)
    try {
      await window.electron.git.configSet({
        userName: editName.trim() || undefined,
        userEmail: editEmail.trim() || undefined
      })
      await loadGitConfig()
      setIsEditingConfig(false)
    } catch {
      // Ignore errors
    } finally {
      setIsSavingConfig(false)
    }
  }, [editName, editEmail, isSavingConfig, loadGitConfig])

  // Cancel editing
  const handleCancelEdit = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    setIsEditingConfig(false)
  }, [])

  // Load git status
  const loadGitStatus = useCallback(async () => {
    if (!projectPath) {
      setGitStatus(null)
      return
    }
    try {
      const status = await window.electron.git.status(projectPath)
      setGitStatus(status)
    } catch {
      setGitStatus(null)
    }
  }, [projectPath])

  // Refresh all account status
  const handleRefresh = useCallback(async (e: React.MouseEvent) => {
    e.stopPropagation()
    if (isRefreshing) return

    setIsRefreshing(true)
    try {
      await Promise.all([reloadAuth(), loadGitConfig(), loadGitStatus()])
    } finally {
      setIsRefreshing(false)
    }
  }, [isRefreshing, reloadAuth, loadGitConfig, loadGitStatus])

  // Load GitHub auth status
  useEffect(() => {
    reloadAuth()
  }, [reloadAuth])

  // Load git config
  useEffect(() => {
    loadGitConfig()
  }, [loadGitConfig])

  // Load Git status for branch when project changes
  useEffect(() => {
    loadGitStatus()
  }, [loadGitStatus])

  // Listen for git status changes (e.g., branch checkout from GitHub tab)
  useEffect(() => {
    const handleGitStatusChanged = (e: CustomEvent<{ projectPath: string }>) => {
      if (e.detail.projectPath === projectPath) {
        loadGitStatus()
      }
    }
    window.addEventListener('git-status-changed', handleGitStatusChanged as EventListener)
    return () => window.removeEventListener('git-status-changed', handleGitStatusChanged as EventListener)
  }, [projectPath, loadGitStatus])

  const status = STATUS_STYLES[connectionState]
  const gitRemoteStatus = gitStatus?.hasRemote ? GIT_STATUS_STYLES.connected : GIT_STATUS_STYLES.disconnected
  const username = githubAuth?.username || 'GitHub CLI'
  const branch = gitStatus?.branch || 'No branch'
  const hasProject = !!projectPath

  const avatarUrl = githubAuth?.username ? `https://github.com/${githubAuth.username}.png` : undefined

  // Collapsed view with tooltip
  if (collapsed) {
    return (
      <div className="relative group py-3 border-t border-[var(--mc-border)]">
        <div
          className="flex flex-col items-center gap-1 cursor-pointer hover:bg-[var(--mc-bg-hover)] py-2 mx-1 rounded transition-colors"
        >
          {avatarUrl ? (
            <img
              src={avatarUrl}
              alt={username}
              className="w-6 h-6 rounded-full border border-[var(--mc-border)] object-cover bg-[var(--mc-bg-tertiary)]"
            />
          ) : (
            <div className="w-6 h-6 rounded-full bg-[var(--mc-bg-tertiary)] border border-[var(--mc-border)] flex items-center justify-center text-xs">
              {username.slice(0, 1).toUpperCase()}
            </div>
          )}
          <div className={`w-1.5 h-1.5 rounded-full ${githubAuth?.isAuthenticated ? 'bg-green-400' : 'bg-gray-400'}`} />
        </div>

        {/* Tooltip */}
        <div className="absolute left-full ml-3 bottom-0 mb-3 w-64 p-3 bg-[var(--mc-bg-secondary)] border border-[var(--mc-border)] shadow-xl rounded-lg opacity-0 group-hover:opacity-100 whitespace-pre z-50 pointer-events-none transition-all translate-x-1 group-hover:translate-x-0">
          <div className="flex items-center gap-3 mb-3">
            {avatarUrl ? (
              <img
                src={avatarUrl}
                alt={username}
                className="w-10 h-10 rounded-full border border-[var(--mc-border)] object-cover bg-[var(--mc-bg-tertiary)]"
              />
            ) : (
              <div className="w-10 h-10 rounded-full bg-[var(--mc-bg-tertiary)] border border-[var(--mc-border)] flex items-center justify-center text-sm">
                {username.slice(0, 1).toUpperCase()}
              </div>
            )}
            <div>
              <div className="text-[10px] uppercase tracking-wider text-[var(--mc-text-muted)] font-semibold mb-0.5">GitHub Account</div>
              <div className="font-medium text-sm">{githubAuth?.isAuthenticated ? username : 'GitHub CLI'}</div>
              <div className={`text-xs ${status.color}`}>{status.text}</div>
            </div>
          </div>

          {hasProject && (
            <div className="space-y-1 mb-3 pt-2 border-t border-[var(--mc-border)]">
              <div className="text-[10px] uppercase tracking-wider text-[var(--mc-text-muted)] font-semibold">Git Status</div>
              <div className="flex items-center gap-2 text-xs">
                <svg className="w-3.5 h-3.5 text-[var(--mc-text-muted)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 20l4-16m2 16l4-16M6 9h14M4 15h14" />
                </svg>
                <span className="truncate">{branch}</span>
              </div>
              <div className={`flex items-center gap-2 text-xs ${gitRemoteStatus.color}`}>
                <div className="w-3.5 flex justify-center text-center">{gitRemoteStatus.icon}</div>
                <span>{gitRemoteStatus.text}</span>
              </div>
            </div>
          )}

          <div className="space-y-1 pt-2 border-t border-[var(--mc-border)]">
            <div className="text-[10px] uppercase tracking-wider text-[var(--mc-text-muted)] font-semibold">Git Identity</div>
            <div className="flex items-center gap-2 text-xs">
              <svg className="w-3.5 h-3.5 text-[var(--mc-text-muted)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
              <span className="truncate">{gitConfig.userName || '(no name)'}</span>
            </div>
            <div className="flex items-center gap-2 text-xs">
              <svg className="w-3.5 h-3.5 text-[var(--mc-text-muted)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
              <span className="truncate">{gitConfig.userEmail || '(no email)'}</span>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // Expanded view
  return (
    <div className="mx-2 my-2 p-3 rounded-lg bg-[var(--mc-bg-secondary)] border border-[var(--mc-border)] shadow-sm">
      {/* Header: User Info & Actions */}
      <div className="mb-3">
        <div className="text-[10px] uppercase tracking-wider text-[var(--mc-text-muted)] font-semibold mb-1.5 flex justify-between items-center">
          <span>GitHub Account</span>
          <div className="flex items-center gap-1">
            <button
              onClick={handleRefresh}
              disabled={isRefreshing}
              title="Refresh status"
              className="p-1 hover:bg-[var(--mc-bg-hover)] rounded text-[var(--mc-text-muted)] hover:text-[var(--mc-text-primary)] transition-colors"
            >
              <svg
                className={`w-3 h-3 ${isRefreshing ? 'animate-spin' : ''}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </button>
            {githubAuth?.isAuthenticated && (
              <button
                onClick={handleLogout}
                disabled={isLoggingOut}
                title="Logout"
                className="p-1 hover:bg-[var(--mc-bg-hover)] rounded text-[var(--mc-text-muted)] hover:text-red-400 transition-colors"
              >
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
              </button>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2.5 overflow-hidden">
          {avatarUrl ? (
            <img
              src={avatarUrl}
              alt={username}
              className="w-9 h-9 rounded-full border border-[var(--mc-border)] object-cover bg-[var(--mc-bg-tertiary)] shrink-0"
            />
          ) : (
            <div className="w-9 h-9 rounded-full bg-[var(--mc-bg-tertiary)] border border-[var(--mc-border)] flex items-center justify-center shrink-0">
              <span className="text-sm font-medium text-[var(--mc-text-primary)]">
                {username.slice(0, 2).toUpperCase()}
              </span>
            </div>
          )}
          <div className="flex flex-col min-w-0">
            <span className="text-sm font-medium truncate text-[var(--mc-text-primary)] leading-tight">
              {githubAuth?.isAuthenticated ? username : 'GitHub CLI'}
            </span>
            <div className={`flex items-center gap-1.5 text-xs mt-0.5 ${status.color}`}>
              <span className="text-[8px]">{status.icon}</span>
              <span className="truncate">{githubAuth?.isAuthenticated ? 'Connected' : status.text}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Divider */}
      <div className="h-px bg-[var(--mc-border)] mb-3" />

      {/* Git Status Section */}
      {hasProject && (
        <div className="mb-3 space-y-2">
          <div className="flex items-center justify-between text-xs">
            <div className="flex items-center gap-1.5 text-[var(--mc-text-muted)] min-w-0">
              <svg className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
              </svg>
              <span className="truncate hover:text-[var(--mc-text-primary)] transition-colors cursor-default" title={branch}>
                {branch}
              </span>
            </div>

            <div className={`flex items-center gap-1.5 ${gitRemoteStatus.color} shrink-0`}>
              <span className="w-1.5 h-1.5 rounded-full bg-current"></span>
              <span className="truncate max-w-[80px]">{gitRemoteStatus.text}</span>
            </div>
          </div>
        </div>
      )}

      {/* Git Config Section */}
      <div className="mt-1.5">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-[10px] uppercase tracking-wider font-semibold text-[var(--mc-text-muted)]">Git Personal Identity</span>
          {!isEditingConfig && (
            <button
              onClick={handleStartEdit}
              title="Edit identity"
              className="p-1 -mr-1 hover:bg-[var(--mc-bg-hover)] rounded text-[var(--mc-text-muted)] hover:text-[var(--mc-text-primary)] transition-colors"
            >
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
              </svg>
            </button>
          )}
        </div>

        {!isEditingConfig ? (
          <div className="group/config relative">
            <div className="space-y-1.5 pb-1">
              <div className="flex items-center gap-2 text-xs text-[var(--mc-text-primary)]">
                <svg className="w-3.5 h-3.5 text-[var(--mc-text-muted)] shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
                <span className="truncate">{gitConfig.userName || '(not set)'}</span>
              </div>
              <div className="flex items-center gap-2 text-xs text-[var(--mc-text-secondary)]">
                <svg className="w-3.5 h-3.5 text-[var(--mc-text-muted)] shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
                <span className="truncate opacity-90">{gitConfig.userEmail || '(not set)'}</span>
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-2 animate-in fade-in duration-200 px-1 py-1 rounded bg-[var(--mc-bg-tertiary)] -mx-1">
            <input
              type="text"
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              placeholder="User Name"
              className="w-full px-2 py-1 text-xs bg-[var(--mc-bg-secondary)] border border-[var(--mc-border)] rounded focus:outline-none focus:border-[var(--mc-accent)] focus:ring-1 focus:ring-[var(--mc-accent)] transition-all"
              autoFocus
            />
            <input
              type="email"
              value={editEmail}
              onChange={(e) => setEditEmail(e.target.value)}
              placeholder="User Email"
              className="w-full px-2 py-1 text-xs bg-[var(--mc-bg-secondary)] border border-[var(--mc-border)] rounded focus:outline-none focus:border-[var(--mc-accent)] focus:ring-1 focus:ring-[var(--mc-accent)] transition-all"
            />
            <div className="flex gap-2 mt-1">
              <button
                onClick={handleSaveConfig}
                disabled={isSavingConfig}
                className="flex-1 px-2 py-1 text-xs bg-[var(--mc-accent)] text-white rounded hover:opacity-90 transition-opacity disabled:opacity-50"
              >
                {isSavingConfig ? '...' : 'Save'}
              </button>
              <button
                onClick={handleCancelEdit}
                className="flex-1 px-2 py-1 text-xs bg-[var(--mc-bg-secondary)] border border-[var(--mc-border)] rounded hover:bg-[var(--mc-bg-hover)] transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
