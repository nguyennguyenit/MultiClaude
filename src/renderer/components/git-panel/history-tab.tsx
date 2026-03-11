import type { GitLogEntry } from '@shared/types'

interface HistoryTabProps {
  entries: GitLogEntry[]
  isLoading?: boolean
}

export function HistoryTab({ entries, isLoading }: HistoryTabProps) {
  if (isLoading) {
    return (
      <div className="px-3 py-3 text-xs text-[var(--mc-text-muted)] text-center">
        Loading history...
      </div>
    )
  }

  if (entries.length === 0) {
    return (
      <div className="px-3 py-3 text-xs text-[var(--mc-text-muted)] text-center">
        No commits yet
      </div>
    )
  }

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / (1000 * 60))
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

    if (diffMins < 60) return `${diffMins}m ago`
    if (diffHours < 24) return `${diffHours}h ago`
    if (diffDays === 1) return 'yesterday'
    if (diffDays < 7) return `${diffDays}d ago`
    if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`
    return date.toLocaleDateString()
  }

  const visible = entries.slice(0, 20)

  return (
    <div>
      {visible.map(entry => (
        <div
          key={entry.hash}
          className="flex items-center gap-1.5 px-3 py-[3px] hover:bg-[var(--mc-bg-hover)] transition-colors cursor-pointer"
        >
          {/* Expand chevron */}
          <svg className="w-2.5 h-2.5 text-[var(--mc-text-muted)] flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
          {/* Short hash */}
          <span className="font-mono text-[10px] text-yellow-500 flex-shrink-0">{entry.hashShort}</span>
          {/* Commit message */}
          <span className="text-[10px] text-[var(--mc-text-primary)] truncate flex-1">{entry.message}</span>
          {/* Relative time */}
          <span className="text-[10px] text-[var(--mc-text-muted)] flex-shrink-0 whitespace-nowrap">{formatDate(entry.date)}</span>
        </div>
      ))}
      {entries.length > 20 && (
        <div className="px-3 py-1 text-[10px] text-[var(--mc-text-muted)] text-center">
          +{entries.length - 20} more
        </div>
      )}
    </div>
  )
}
