import { useState, useEffect, useCallback, useRef } from 'react'
import type { GitHubAuth, GitStatus } from '@shared/types'

interface ActivityBarAccountSectionProps {
  collapsed: boolean
  projectPath?: string
}

export function ActivityBarAccountSection({ collapsed, projectPath }: ActivityBarAccountSectionProps) {
  const [githubAuth, setGithubAuth] = useState<GitHubAuth | null>(null)
  const [gitStatus, setGitStatus] = useState<GitStatus | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  const loadAuth = useCallback(async () => {
    try {
      const auth = await window.electron.github.authStatus()
      setGithubAuth(auth)
    } catch {
      // Ignore
    } finally {
      setIsLoading(false)
    }
  }, [])

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

  useEffect(() => {
    loadAuth()
  }, [loadAuth])

  useEffect(() => {
    loadGitStatus()
  }, [loadGitStatus])

  // Listen for git status changes
  useEffect(() => {
    const handleGitStatusChanged = (e: CustomEvent<{ projectPath: string }>) => {
      if (e.detail.projectPath === projectPath) {
        loadGitStatus()
      }
    }
    window.addEventListener('git-status-changed', handleGitStatusChanged as EventListener)
    return () => window.removeEventListener('git-status-changed', handleGitStatusChanged as EventListener)
  }, [projectPath, loadGitStatus])

  // Listen for git branch changes
  useEffect(() => {
    if (!projectPath) return
    const unsubscribe = window.electron.git.onBranchChanged((data) => {
      if (data.projectPath === projectPath) {
        loadGitStatus()
      }
    })
    return unsubscribe
  }, [projectPath, loadGitStatus])

  const username = githubAuth?.username || 'GitHub'
  const avatarUrl = githubAuth?.username ? `https://github.com/${githubAuth.username}.png` : undefined
  const isAuthenticated = githubAuth?.isAuthenticated || false

  if (isLoading) {
    return (
      <div className={`px-3 py-2 ${collapsed ? 'flex justify-center' : ''}`}>
        <div className="w-6 h-6 rounded-full bg-[var(--mc-bg-tertiary)] animate-pulse" />
      </div>
    )
  }

  return (
    <div className="relative group border-t border-[var(--mc-border)]">
      <div
        className={`
          flex items-center gap-3 px-3 py-2 cursor-pointer
          transition-colors duration-150
          ${collapsed ? 'justify-center' : ''}
          hover:bg-[var(--mc-bg-hover)]
        `}
      >
        {/* Avatar */}
        {avatarUrl ? (
          <img
            src={avatarUrl}
            alt={username}
            className="w-6 h-6 rounded-full border border-[var(--mc-border)] object-cover bg-[var(--mc-bg-tertiary)] flex-shrink-0"
          />
        ) : (
          <div className="w-6 h-6 rounded-full bg-[var(--mc-bg-tertiary)] border border-[var(--mc-border)] flex items-center justify-center text-xs flex-shrink-0">
            {username.slice(0, 1).toUpperCase()}
          </div>
        )}

        {/* Status indicator */}
        <div
          className={`absolute ${collapsed ? 'bottom-1 right-2' : 'left-7 bottom-1.5'} w-2 h-2 rounded-full border border-[var(--mc-bg-secondary)] ${
            isAuthenticated ? 'bg-green-400' : 'bg-gray-400'
          }`}
        />

        {/* Username and branch (expanded only) */}
        {!collapsed && (
          <div className="flex flex-col min-w-0 flex-1">
            <span className="text-xs font-medium truncate text-[var(--mc-text-primary)]">
              {isAuthenticated ? username : 'Not signed in'}
            </span>
            {gitStatus?.branch && (
              <span className="text-[10px] text-[var(--mc-text-muted)] truncate">
                {gitStatus.branch}
              </span>
            )}
          </div>
        )}
      </div>

      {/* Tooltip when collapsed */}
      {collapsed && (
        <div className="absolute left-full ml-2 px-3 py-2 bg-[var(--mc-bg-tertiary)] text-xs rounded opacity-0 group-hover:opacity-100 whitespace-nowrap z-50 pointer-events-none transition-opacity shadow-lg border border-[var(--mc-border)]">
          <div className="font-medium">{isAuthenticated ? username : 'Not signed in'}</div>
          {gitStatus?.branch && (
            <div className="text-[var(--mc-text-muted)] mt-0.5">{gitStatus.branch}</div>
          )}
          <div className={`text-[10px] mt-1 ${isAuthenticated ? 'text-green-400' : 'text-gray-400'}`}>
            {isAuthenticated ? 'Connected' : 'Not connected'}
          </div>
        </div>
      )}
    </div>
  )
}
