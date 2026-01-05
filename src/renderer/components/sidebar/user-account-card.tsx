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
    if (!projectPath) {
      setGitStatus(null)
      return
    }

    const loadGitStatus = async () => {
      try {
        const status = await window.electron.git.status(projectPath)
        setGitStatus(status)
      } catch {
        setGitStatus(null)
      }
    }
    loadGitStatus()
  }, [projectPath])

  const status = STATUS_STYLES[connectionState]
  const gitRemoteStatus = gitStatus?.hasRemote ? GIT_STATUS_STYLES.connected : GIT_STATUS_STYLES.disconnected
  const username = githubAuth?.username || 'GitHub CLI'
  const branch = gitStatus?.branch || (projectPath ? 'No branch' : 'No project')

  // Collapsed view with tooltip
  if (collapsed) {
    return (
      <div className="relative group py-3">
        <div
          className="flex flex-col items-center gap-1 cursor-pointer hover:bg-[var(--mc-bg-hover)] py-2 mx-1 rounded"
        >
          <span className="text-xl">👤</span>
          <span className={`text-xs ${status.color}`}>{status.icon}</span>
        </div>
        {/* Tooltip */}
        <div className="absolute left-full ml-2 top-1/2 -translate-y-1/2 px-3 py-2 bg-[var(--mc-bg-tertiary)] border border-[var(--mc-border)] text-xs rounded-lg opacity-0 group-hover:opacity-100 whitespace-pre z-50 pointer-events-none transition-opacity shadow-lg">
          <div className="font-medium mb-1">GitHub CLI</div>
          <div className={`flex items-center gap-1 ${status.color}`}>
            <span>{status.icon}</span>
            <span>{githubAuth?.isAuthenticated ? username : status.text}</span>
          </div>
          {projectPath && (
            <>
              <div className="font-medium mt-2 mb-1">Git Remote</div>
              <div className={`flex items-center gap-1 ${gitRemoteStatus.color}`}>
                <span>{gitRemoteStatus.icon}</span>
                <span>{gitRemoteStatus.text}</span>
              </div>
              <div className="text-[var(--mc-text-muted)] mt-1">Branch: {branch}</div>
            </>
          )}
          <div className="font-medium mt-2 mb-1">Git Config</div>
          <div className="text-[var(--mc-text-muted)]">
            {gitConfig.userName || '(no name)'}
          </div>
          <div className="text-[var(--mc-text-muted)]">
            {gitConfig.userEmail || '(no email)'}
          </div>
        </div>
      </div>
    )
  }

  // Expanded view
  return (
    <div className="mx-3 my-2 p-3 rounded-lg bg-[var(--mc-bg-tertiary)] border border-[var(--mc-border)] transition-colors">
      {/* GitHub CLI Section */}
      <div className="flex items-center gap-2 mb-0.5">
        <span className="text-xs text-[var(--mc-text-muted)]">GitHub CLI</span>
        {githubAuth?.isAuthenticated && (
          <button
            onClick={handleLogout}
            disabled={isLoggingOut}
            title="Logout from GitHub CLI"
            className="p-0.5 hover:bg-[var(--mc-bg-hover)] rounded text-[var(--mc-text-muted)] hover:text-[var(--mc-text-secondary)] transition-colors disabled:opacity-50 ml-auto"
          >
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
          </button>
        )}
      </div>
      <div className={`flex items-center gap-1.5 text-xs ${status.color}`}>
        <span>{status.icon}</span>
        <span>{githubAuth?.isAuthenticated ? username : status.text}</span>
      </div>

      {/* Git Remote Section */}
      {projectPath && (
        <>
          <div className="flex items-center gap-2 mt-2 mb-0.5">
            <span className="text-xs text-[var(--mc-text-muted)]">Git Remote</span>
          </div>
          <div className={`flex items-center gap-1.5 text-xs ${gitRemoteStatus.color}`}>
            <span>{gitRemoteStatus.icon}</span>
            <span>{gitRemoteStatus.text}</span>
          </div>
          <div className="flex items-center gap-1.5 text-xs text-[var(--mc-text-muted)] mt-1">
            <span>🌿</span>
            <span className="truncate">{branch}</span>
          </div>
        </>
      )}

      {/* Git Config Section */}
      <div className="flex items-center gap-2 mt-2 mb-0.5">
        <span className="text-xs text-[var(--mc-text-muted)]">Git Config</span>
        {!isEditingConfig && (
          <button
            onClick={handleStartEdit}
            title="Edit git config"
            className="p-0.5 hover:bg-[var(--mc-bg-hover)] rounded text-[var(--mc-text-muted)] hover:text-[var(--mc-text-secondary)] transition-colors ml-auto"
          >
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
            </svg>
          </button>
        )}
      </div>
      {isEditingConfig ? (
        <div className="space-y-2">
          <input
            type="text"
            value={editName}
            onChange={(e) => setEditName(e.target.value)}
            placeholder="user.name"
            className="w-full px-2 py-1 text-xs bg-[var(--mc-bg-secondary)] border border-[var(--mc-border)] rounded focus:outline-none focus:border-[var(--mc-accent)]"
            onClick={(e) => e.stopPropagation()}
          />
          <input
            type="email"
            value={editEmail}
            onChange={(e) => setEditEmail(e.target.value)}
            placeholder="user.email"
            className="w-full px-2 py-1 text-xs bg-[var(--mc-bg-secondary)] border border-[var(--mc-border)] rounded focus:outline-none focus:border-[var(--mc-accent)]"
            onClick={(e) => e.stopPropagation()}
          />
          <div className="flex gap-1.5">
            <button
              onClick={handleSaveConfig}
              disabled={isSavingConfig}
              className="flex-1 px-2 py-1 text-xs bg-[var(--mc-accent)] text-white rounded hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              {isSavingConfig ? 'Saving...' : 'Save'}
            </button>
            <button
              onClick={handleCancelEdit}
              className="flex-1 px-2 py-1 text-xs bg-[var(--mc-bg-secondary)] border border-[var(--mc-border)] rounded hover:bg-[var(--mc-bg-hover)] transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <div className="text-xs text-[var(--mc-text-secondary)]">
          <div className="truncate">{gitConfig.userName || '(no name)'}</div>
          <div className="truncate text-[var(--mc-text-muted)]">{gitConfig.userEmail || '(no email)'}</div>
        </div>
      )}
    </div>
  )
}
