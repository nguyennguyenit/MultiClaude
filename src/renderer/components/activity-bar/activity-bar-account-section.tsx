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
        <div className={`${collapsed ? 'w-8 h-8' : 'w-6 h-6'} rounded-full bg-[var(--mc-bg-tertiary)] animate-pulse`} />
      </div>
    )
  }

  const avatarSize = collapsed ? 'w-8 h-8' : 'w-9 h-9'

  // Collapsed view - icon only with tooltip
  if (collapsed) {
    return (
      <div className="relative group border-t border-[var(--mc-border)]">
        <div className="flex justify-center px-3 py-2 cursor-pointer hover:bg-[var(--mc-bg-hover)] transition-colors">
          {avatarUrl ? (
            <img src={avatarUrl} alt={username} className={`${avatarSize} rounded-full border border-[var(--mc-border)] object-cover bg-[var(--mc-bg-tertiary)]`} />
          ) : (
            <div className={`${avatarSize} rounded-full bg-[var(--mc-bg-tertiary)] border border-[var(--mc-border)] flex items-center justify-center text-sm`}>
              {username.slice(0, 1).toUpperCase()}
            </div>
          )}
          <div className={`absolute bottom-1 right-2 w-2 h-2 rounded-full border border-[var(--mc-bg-secondary)] ${isAuthenticated ? 'bg-green-400' : 'bg-gray-400'}`} />
        </div>
        {/* Tooltip */}
        <div className="absolute left-full ml-2 px-3 py-2 bg-[var(--mc-bg-tertiary)] text-xs rounded opacity-0 group-hover:opacity-100 whitespace-nowrap z-50 pointer-events-none transition-opacity shadow-lg border border-[var(--mc-border)]">
          <div className="font-medium">{isAuthenticated ? username : 'Not signed in'}</div>
          {gitStatus?.branch && <div className="text-[var(--mc-text-muted)] mt-0.5">{gitStatus.branch}</div>}
          <div className={`text-[10px] mt-1 ${isAuthenticated ? 'text-green-400' : 'text-gray-400'}`}>
            {isAuthenticated ? 'Connected' : 'Not connected'}
          </div>
        </div>
      </div>
    )
  }

  // Expanded view - full info like old sidebar
  return (
    <div className="mx-2 my-2 p-3 rounded-lg bg-[var(--mc-bg-secondary)] border border-[var(--mc-border)]">
      {/* Header */}
      <div className="text-[10px] uppercase tracking-wider text-[var(--mc-text-muted)] font-semibold mb-2">GitHub Account</div>

      {/* User info */}
      <div className="flex items-center gap-2.5 mb-3">
        {avatarUrl ? (
          <img src={avatarUrl} alt={username} className="w-9 h-9 rounded-full border border-[var(--mc-border)] object-cover bg-[var(--mc-bg-tertiary)]" />
        ) : (
          <div className="w-9 h-9 rounded-full bg-[var(--mc-bg-tertiary)] border border-[var(--mc-border)] flex items-center justify-center text-sm">
            {username.slice(0, 1).toUpperCase()}
          </div>
        )}
        <div className="flex flex-col min-w-0">
          <span className="text-sm font-medium truncate">{isAuthenticated ? username : 'GitHub CLI'}</span>
          <span className={`text-xs ${isAuthenticated ? 'text-green-400' : 'text-gray-400'}`}>
            {isAuthenticated ? 'Connected' : 'Not logged in'}
          </span>
        </div>
      </div>

      {/* Git status */}
      {gitStatus && (
        <div className="pt-2 border-t border-[var(--mc-border)] space-y-1.5">
          <div className="flex items-center justify-between text-xs">
            <div className="flex items-center gap-1.5 text-[var(--mc-text-muted)]">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
              </svg>
              <span className="truncate">{gitStatus.branch || 'No branch'}</span>
            </div>
            <span className={`${gitStatus.hasRemote ? 'text-green-400' : 'text-gray-400'}`}>
              {gitStatus.hasRemote ? '● Connected' : '○ No remote'}
            </span>
          </div>
        </div>
      )}
    </div>
  )
}
