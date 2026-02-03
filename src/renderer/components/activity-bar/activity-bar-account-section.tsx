import { useState, useEffect, useCallback } from 'react'
import type { GitHubAuth, GitStatus, GitConfig } from '@shared/types'

interface ActivityBarAccountSectionProps {
  collapsed: boolean
  projectPath?: string
}

type ConnectionState = 'connected' | 'disconnected' | 'syncing' | 'error'

export function ActivityBarAccountSection({ collapsed, projectPath }: ActivityBarAccountSectionProps) {
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

  const loadGitConfig = useCallback(async () => {
    try {
      const config = await window.electron.git.configGet()
      setGitConfig(config)
    } catch { /* ignore */ }
  }, [])

  const handleStartEdit = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    setEditName(gitConfig.userName || '')
    setEditEmail(gitConfig.userEmail || '')
    setIsEditingConfig(true)
  }, [gitConfig])

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
    } catch { /* ignore */ }
    finally { setIsSavingConfig(false) }
  }, [editName, editEmail, isSavingConfig, loadGitConfig])

  const handleCancelEdit = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    setIsEditingConfig(false)
  }, [])

  const loadGitStatus = useCallback(async () => {
    if (!projectPath) { setGitStatus(null); return }
    try {
      const status = await window.electron.git.status(projectPath)
      setGitStatus(status)
    } catch { setGitStatus(null) }
  }, [projectPath])

  const handleRefresh = useCallback(async (e: React.MouseEvent) => {
    e.stopPropagation()
    if (isRefreshing) return
    setIsRefreshing(true)
    try {
      await Promise.all([reloadAuth(), loadGitConfig(), loadGitStatus()])
    } finally { setIsRefreshing(false) }
  }, [isRefreshing, reloadAuth, loadGitConfig, loadGitStatus])

  useEffect(() => { reloadAuth() }, [reloadAuth])
  useEffect(() => { loadGitConfig() }, [loadGitConfig])
  useEffect(() => { loadGitStatus() }, [loadGitStatus])

  useEffect(() => {
    const handler = (e: CustomEvent<{ projectPath: string }>) => {
      if (e.detail.projectPath === projectPath) loadGitStatus()
    }
    window.addEventListener('git-status-changed', handler as EventListener)
    return () => window.removeEventListener('git-status-changed', handler as EventListener)
  }, [projectPath, loadGitStatus])

  useEffect(() => {
    if (!projectPath) return
    const unsubscribe = window.electron.git.onBranchChanged((data) => {
      if (data.projectPath === projectPath) loadGitStatus()
    })
    return unsubscribe
  }, [projectPath, loadGitStatus])

  useEffect(() => {
    if (!projectPath) return
    window.electron.git.watchProject(projectPath)
    return () => { window.electron.git.unwatchProject(projectPath) }
  }, [projectPath])

  const username = githubAuth?.username || 'GitHub CLI'
  const avatarUrl = githubAuth?.username ? `https://github.com/${githubAuth.username}.png` : undefined
  const isAuthenticated = githubAuth?.isAuthenticated || false
  const statusColor = connectionState === 'connected' ? 'text-green-400' : connectionState === 'error' ? 'text-red-400' : connectionState === 'syncing' ? 'text-amber-400' : 'text-gray-400'

  // Collapsed view
  if (collapsed) {
    return (
      <div className="relative group border-t border-[var(--mc-border)]">
        <div className="flex justify-center px-3 py-2 cursor-pointer hover:bg-[var(--mc-bg-hover)] transition-colors">
          {avatarUrl ? (
            <img src={avatarUrl} alt={username} className="w-6 h-6 flex-shrink-0 border border-[var(--mc-border)] object-cover bg-[var(--mc-bg-tertiary)]" style={{ borderRadius: '50%' }} />
          ) : (
            <div className="w-6 h-6 flex-shrink-0 bg-[var(--mc-bg-tertiary)] border border-[var(--mc-border)] flex items-center justify-center text-xs" style={{ borderRadius: '50%' }}>
              {username.slice(0, 1).toUpperCase()}
            </div>
          )}
          <div className={`absolute bottom-1.5 right-2.5 w-1.5 h-1.5 border border-[var(--mc-bg-secondary)] ${isAuthenticated ? 'bg-green-400' : 'bg-gray-400'}`} style={{ borderRadius: '50%' }} />
        </div>
        <div className="absolute left-full ml-2 px-3 py-2 bg-[var(--mc-bg-tertiary)] text-xs rounded opacity-0 group-hover:opacity-100 whitespace-nowrap z-50 pointer-events-none transition-opacity shadow-lg border border-[var(--mc-border)]">
          <div className="font-medium">{isAuthenticated ? username : 'Not signed in'}</div>
          {gitStatus?.branch && <div className="text-[var(--mc-text-muted)] mt-0.5">{gitStatus.branch}</div>}
          <div className={`text-[10px] mt-1 ${statusColor}`}>
            {connectionState === 'connected' ? 'Connected' : connectionState === 'syncing' ? 'Syncing...' : 'Not connected'}
          </div>
        </div>
      </div>
    )
  }

  // Expanded view - full info
  return (
    <div className="mx-2 my-2 p-3 rounded-lg bg-[var(--mc-bg-secondary)] border border-[var(--mc-border)]">
      {/* Header with actions */}
      <div className="flex items-center justify-between mb-2">
        <span className="text-[10px] uppercase tracking-wider text-[var(--mc-text-muted)] font-semibold">GitHub Account</span>
        <div className="flex items-center gap-1">
          <button onClick={handleRefresh} disabled={isRefreshing} title="Refresh" className="p-1 hover:bg-[var(--mc-bg-hover)] rounded text-[var(--mc-text-muted)] hover:text-[var(--mc-text-primary)]">
            <svg className={`w-3 h-3 ${isRefreshing ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </button>
          {isAuthenticated && (
            <button onClick={handleLogout} disabled={isLoggingOut} title="Logout" className="p-1 hover:bg-[var(--mc-bg-hover)] rounded text-[var(--mc-text-muted)] hover:text-red-400">
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* User info */}
      <div className="flex items-center gap-2 mb-2">
        {avatarUrl ? (
          <img src={avatarUrl} alt={username} className="w-6 h-6 flex-shrink-0 border border-[var(--mc-border)] object-cover bg-[var(--mc-bg-tertiary)]" style={{ borderRadius: '50%' }} />
        ) : (
          <div className="w-6 h-6 flex-shrink-0 bg-[var(--mc-bg-tertiary)] border border-[var(--mc-border)] flex items-center justify-center text-[10px]" style={{ borderRadius: '50%' }}>
            {username.slice(0, 1).toUpperCase()}
          </div>
        )}
        <div className="flex flex-col min-w-0">
          <span className="text-xs font-medium truncate">{isAuthenticated ? username : 'GitHub CLI'}</span>
          <span className={`text-[10px] ${statusColor}`}>
            {connectionState === 'connected' ? 'Connected' : connectionState === 'syncing' ? 'Syncing...' : connectionState === 'error' ? 'Error' : 'Not logged in'}
          </span>
        </div>
      </div>

      <div className="h-px bg-[var(--mc-border)] mb-2" />

      {/* Git status */}
      {projectPath && gitStatus && (
        <div className="mb-2 space-y-1">
          <div className="flex items-center justify-between text-[10px]">
            <div className="flex items-center gap-1 text-[var(--mc-text-muted)]">
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
              </svg>
              <span className="truncate">{gitStatus.branch || 'No branch'}</span>
            </div>
            <span className={gitStatus.hasRemote ? 'text-green-400' : 'text-gray-400'}>
              {gitStatus.hasRemote ? '● Remote' : '○ Local'}
            </span>
          </div>
        </div>
      )}

      {/* Git Identity */}
      <div>
        <div className="flex items-center justify-between mb-1">
          <span className="text-[9px] uppercase tracking-wider font-semibold text-[var(--mc-text-muted)]">Git Identity</span>
          {!isEditingConfig && (
            <button onClick={handleStartEdit} title="Edit" className="p-0.5 -mr-0.5 hover:bg-[var(--mc-bg-hover)] rounded text-[var(--mc-text-muted)] hover:text-[var(--mc-text-primary)]">
              <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
              </svg>
            </button>
          )}
        </div>

        {!isEditingConfig ? (
          <div className="space-y-1">
            <div className="flex items-center gap-1.5 text-[10px]">
              <svg className="w-3 h-3 text-[var(--mc-text-muted)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
              <span className="truncate">{gitConfig.userName || '(not set)'}</span>
            </div>
            <div className="flex items-center gap-1.5 text-[10px] text-[var(--mc-text-secondary)]">
              <svg className="w-3 h-3 text-[var(--mc-text-muted)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
              <span className="truncate">{gitConfig.userEmail || '(not set)'}</span>
            </div>
          </div>
        ) : (
          <div className="space-y-1.5 p-1 rounded bg-[var(--mc-bg-tertiary)] -mx-1">
            <input type="text" value={editName} onChange={(e) => setEditName(e.target.value)} placeholder="User Name" className="w-full px-1.5 py-0.5 text-[10px] bg-[var(--mc-bg-secondary)] border border-[var(--mc-border)] rounded focus:outline-none focus:border-[var(--mc-accent)]" autoFocus />
            <input type="email" value={editEmail} onChange={(e) => setEditEmail(e.target.value)} placeholder="User Email" className="w-full px-1.5 py-0.5 text-[10px] bg-[var(--mc-bg-secondary)] border border-[var(--mc-border)] rounded focus:outline-none focus:border-[var(--mc-accent)]" />
            <div className="flex gap-1.5">
              <button onClick={handleSaveConfig} disabled={isSavingConfig} className="flex-1 px-1.5 py-0.5 text-[10px] bg-[var(--mc-accent)] text-white rounded hover:opacity-90 disabled:opacity-50">
                {isSavingConfig ? '...' : 'Save'}
              </button>
              <button onClick={handleCancelEdit} className="flex-1 px-1.5 py-0.5 text-[10px] bg-[var(--mc-bg-secondary)] border border-[var(--mc-border)] rounded hover:bg-[var(--mc-bg-hover)]">
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
