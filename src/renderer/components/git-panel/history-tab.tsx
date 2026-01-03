import type { GitLogEntry } from '@shared/types'

interface HistoryTabProps {
  entries: GitLogEntry[]
  isLoading?: boolean
}

export function HistoryTab({ entries, isLoading }: HistoryTabProps) {
  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center text-xs text-[var(--mc-text-muted)]">
        Loading history...
      </div>
    )
  }

  if (entries.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center text-xs text-[var(--mc-text-muted)]">
        No commits yet
      </div>
    )
  }

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

    if (diffDays === 0) return 'today'
    if (diffDays === 1) return 'yesterday'
    if (diffDays < 7) return `${diffDays} days ago`
    if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`
    return date.toLocaleDateString()
  }

  return (
    <div className="flex-1 overflow-y-auto">
      {entries.map((entry, idx) => (
        <div
          key={entry.hash}
          className={`px-3 py-2 ${idx !== entries.length - 1 ? 'border-b border-[var(--mc-border)]' : ''}`}
        >
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium truncate">{entry.message}</p>
              <div className="flex items-center gap-2 mt-1 text-[10px] text-[var(--mc-text-muted)]">
                <span className="font-mono text-yellow-500">{entry.hashShort}</span>
                <span>{entry.author}</span>
                <span>{formatDate(entry.date)}</span>
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}
