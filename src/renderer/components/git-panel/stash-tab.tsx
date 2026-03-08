import { useState } from 'react'
import type { GitStashEntry } from '@shared/types'

interface StashTabProps {
  entries: GitStashEntry[]
  isLoading?: boolean
  showSaveInput?: boolean
  onSaveInputClose?: () => void
  onSave: (message?: string) => Promise<void>
  onApply: (index: number) => Promise<void>
  onPop: (index: number) => Promise<void>
  onDrop: (index: number) => Promise<void>
}

export function StashTab({
  entries,
  isLoading,
  showSaveInput,
  onSaveInputClose,
  onSave,
  onApply,
  onPop,
  onDrop
}: StashTabProps) {
  const [stashMessage, setStashMessage] = useState('')
  const [saving, setSaving] = useState(false)

  const handleSave = async () => {
    setSaving(true)
    await onSave(stashMessage || undefined)
    setStashMessage('')
    setSaving(false)
    onSaveInputClose?.()
  }

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr)
    return date.toLocaleString()
  }

  return (
    <div>
      {/* Inline save input (shown when header action icon clicked) */}
      {showSaveInput && (
        <div className="px-3 py-2 border-b border-[var(--mc-border)] space-y-1">
          <input
            type="text"
            value={stashMessage}
            onChange={(e) => setStashMessage(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSave()}
            placeholder="Stash message (optional)"
            className="w-full px-2 py-1 text-xs bg-[var(--mc-bg-hover)] border border-[var(--mc-border)] rounded focus:outline-none focus:border-[var(--mc-accent)]"
            autoFocus
          />
          <div className="flex gap-1">
            <button
              onClick={onSaveInputClose}
              className="flex-1 px-2 py-1 text-xs bg-[var(--mc-bg-hover)] hover:bg-[var(--mc-bg-active)] rounded"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex-1 px-2 py-1 text-xs bg-[var(--mc-accent)] text-[var(--mc-bg-primary)] hover:opacity-90 disabled:opacity-50 rounded"
            >
              {saving ? '...' : 'Stash'}
            </button>
          </div>
        </div>
      )}

      {/* Stash list */}
      {isLoading ? (
        <div className="px-3 py-3 text-xs text-[var(--mc-text-muted)] text-center">
          Loading stashes...
        </div>
      ) : entries.length === 0 ? (
        <div className="px-3 py-3 text-xs text-[var(--mc-text-muted)] text-center">
          No stashes
        </div>
      ) : (
        <div>
          {entries.map((entry) => (
            <div
              key={entry.index}
              className="px-3 py-2 border-b border-[var(--mc-border)] hover:bg-[var(--mc-bg-hover)]"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium truncate">
                    stash@{'{' + entry.index + '}'}: {entry.message}
                  </p>
                  <p className="text-[10px] text-[var(--mc-text-muted)] mt-0.5">
                    {formatDate(entry.date)}
                  </p>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => onApply(entry.index)}
                    title="Apply"
                    className="p-1 hover:bg-[var(--mc-bg-active)] rounded text-blue-400"
                  >
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </button>
                  <button
                    onClick={() => onPop(entry.index)}
                    title="Pop"
                    className="p-1 hover:bg-[var(--mc-bg-active)] rounded text-green-400"
                  >
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" />
                    </svg>
                  </button>
                  <button
                    onClick={() => onDrop(entry.index)}
                    title="Drop"
                    className="p-1 hover:bg-[var(--mc-bg-active)] rounded text-red-400"
                  >
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                        d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
