import { useState, useEffect } from 'react'
import type { GitHubAuth, GitStatus } from '@shared/types'

interface UserAccountCardProps {
  collapsed: boolean
  projectPath?: string
}

type ConnectionState = 'connected' | 'disconnected' | 'syncing' | 'error'

const STATUS_STYLES: Record<ConnectionState, { icon: string; color: string; text: string }> = {
  connected: { icon: '●', color: 'text-green-400', text: 'Connected' },
  disconnected: { icon: '○', color: 'text-gray-400', text: 'Disconnected' },
  syncing: { icon: '◐', color: 'text-amber-400', text: 'Syncing...' },
  error: { icon: '●', color: 'text-red-400', text: 'Error' }
}

export function UserAccountCard({ collapsed, projectPath }: UserAccountCardProps) {
  const [githubAuth, setGithubAuth] = useState<GitHubAuth | null>(null)
  const [gitStatus, setGitStatus] = useState<GitStatus | null>(null)
  const [connectionState, setConnectionState] = useState<ConnectionState>('disconnected')

  // Load GitHub auth status
  useEffect(() => {
    const loadAuth = async () => {
      try {
        setConnectionState('syncing')
        const auth = await window.electron.github.authStatus()
        setGithubAuth(auth)
        setConnectionState(auth.isAuthenticated ? 'connected' : 'disconnected')
      } catch {
        setConnectionState('error')
      }
    }
    loadAuth()
  }, [])

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
  const username = githubAuth?.username || 'Not logged in'
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
          <div className="font-medium">{username}</div>
          <div className={status.color}>{status.text}</div>
          <div className="text-[var(--mc-text-muted)]">Branch: {branch}</div>
        </div>
      </div>
    )
  }

  // Expanded view
  return (
    <div className="mx-3 my-2 p-3 rounded-lg bg-[var(--mc-bg-tertiary)] border border-[var(--mc-border)] cursor-pointer hover:border-[var(--mc-accent)] transition-colors">
      <div className="flex items-center gap-2 mb-1">
        <span className="text-base">👤</span>
        <span className="font-medium text-sm truncate flex-1">{username}</span>
      </div>
      <div className={`flex items-center gap-1.5 text-xs ${status.color}`}>
        <span>{status.icon}</span>
        <span>{status.text}</span>
      </div>
      {(gitStatus?.branch || projectPath) && (
        <div className="flex items-center gap-1.5 text-xs text-[var(--mc-text-muted)] mt-1">
          <span>🌿</span>
          <span className="truncate">{branch}</span>
        </div>
      )}
    </div>
  )
}
