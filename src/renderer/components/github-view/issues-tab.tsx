import { useState, useEffect, useCallback } from 'react'
import type { GitHubIssue } from '@shared/types'

interface IssuesTabProps {
  projectPath: string
}

// Format relative time
function formatRelativeTime(dateStr: string): string {
  const date = new Date(dateStr)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMs / 3600000)
  const diffDays = Math.floor(diffMs / 86400000)

  if (diffMins < 60) return `${diffMins}m ago`
  if (diffHours < 24) return `${diffHours}h ago`
  if (diffDays < 30) return `${diffDays}d ago`
  return date.toLocaleDateString()
}

export function IssuesTab({ projectPath }: IssuesTabProps) {
  const [issues, setIssues] = useState<GitHubIssue[]>([])
  const [filter, setFilter] = useState<'open' | 'closed' | 'all'>('open')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchIssues = useCallback(async () => {
    if (!projectPath) return
    setLoading(true)
    setError(null)
    try {
      const result = await window.electron.github.listIssues(projectPath, filter)
      if (result.success) {
        setIssues(result.data)
      } else {
        setError(result.error || 'Failed to fetch issues')
      }
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setLoading(false)
    }
  }, [projectPath, filter])

  useEffect(() => {
    fetchIssues()
  }, [fetchIssues])

  return (
    <div className="flex-1 flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between p-3 border-b border-[var(--mc-border)]">
        <select
          value={filter}
          onChange={e => setFilter(e.target.value as typeof filter)}
          className="bg-[var(--mc-bg-tertiary)] text-[var(--mc-text-primary)] text-sm px-2 py-1 rounded border border-[var(--mc-border)]"
        >
          <option value="open">Open</option>
          <option value="closed">Closed</option>
          <option value="all">All</option>
        </select>
        <button
          onClick={fetchIssues}
          disabled={loading}
          className="p-1.5 hover:bg-[var(--mc-bg-hover)] rounded disabled:opacity-50"
          title="Refresh"
        >
          <span className={loading ? 'animate-spin inline-block' : ''}>↻</span>
        </button>
      </div>

      {/* Error state */}
      {error && (
        <div className="p-3 text-sm text-red-400 bg-red-900/20">
          {error}
        </div>
      )}

      {/* Loading state */}
      {loading && issues.length === 0 && (
        <div className="flex-1 flex items-center justify-center text-[var(--mc-text-muted)]">
          Loading issues...
        </div>
      )}

      {/* Empty state */}
      {!loading && !error && issues.length === 0 && (
        <div className="flex-1 flex items-center justify-center text-[var(--mc-text-muted)]">
          No issues found
        </div>
      )}

      {/* Issues list */}
      <div className="flex-1 overflow-auto">
        {issues.map(issue => (
          <div
            key={issue.number}
            className="p-3 border-b border-[var(--mc-border)] hover:bg-[var(--mc-bg-hover)] cursor-pointer"
          >
            <div className="flex items-start gap-2">
              <span className={`text-xs px-1.5 py-0.5 rounded ${
                issue.state === 'open'
                  ? 'bg-green-600/20 text-green-400'
                  : 'bg-purple-600/20 text-purple-400'
              }`}>
                {issue.state}
              </span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-[var(--mc-text-muted)] text-sm">#{issue.number}</span>
                  <span className="text-sm font-medium truncate">{issue.title}</span>
                </div>
                <div className="flex items-center gap-2 mt-1 text-xs text-[var(--mc-text-muted)]">
                  <span>@{issue.author?.login || 'unknown'}</span>
                  <span>·</span>
                  <span>{formatRelativeTime(issue.createdAt)}</span>
                </div>
                {issue.labels && issue.labels.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-1.5">
                    {issue.labels.map(label => (
                      <span
                        key={label.name}
                        className="text-xs px-1.5 py-0.5 rounded"
                        style={{
                          backgroundColor: `#${label.color}30`,
                          color: `#${label.color}`,
                          border: `1px solid #${label.color}50`
                        }}
                      >
                        {label.name}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
