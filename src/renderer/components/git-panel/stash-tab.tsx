import { useState } from 'react'
import type { GitStashEntry } from '@shared/types'

interface StashTabProps {
  entries: GitStashEntry[]
  isLoading?: boolean
  onSave: (message?: string) => Promise<void>
  onApply: (index: number) => Promise<void>
  onPop: (index: number) => Promise<void>
  onDrop: (index: number) => Promise<void>
}

export function StashTab({
  entries,
  isLoading,
  onSave,
  onApply,
  onPop,
  onDrop
}: StashTabProps) {
  const [showSaveInput, setShowSaveInput] = useState(false)
  const [stashMessage, setStashMessage] = useState('')
  const [saving, setSaving] = useState(false)

  const handleSave = async () => {
    setSaving(true)
    await onSave(stashMessage || undefined)
    setStashMessage('')
    setShowSaveInput(false)
    setSaving(false)
  }

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr)
    return date.toLocaleString()
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Stash button */}
      <div className="px-3 py-2 border-b border-[var(--mc-border)]">
        {showSaveInput ? (
          <div className="space-y-1">
            <input
              type="text"
              value={stashMessage}
              onChange={(e) => setStashMessage(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSave()}
              placeholder="Stash message (optional)"
              className="w-full px-2 py-1 text-xs bg-[var(--mc-bg-hover)] rounded"
              autoFocus
            />
            <div className="flex gap-1">
              <button
                onClick={() => setShowSaveInput(false)}
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
        ) : (
          <button
            onClick={() => setShowSaveInput(true)}
            className="w-full px-2 py-1 text-xs bg-[var(--mc-bg-hover)] hover:bg-[var(--mc-bg-active)] rounded flex items-center justify-center gap-1"
          >
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
            </svg>
            Stash Changes
          </button>
        )}
      </div>

      {/* Stash list */}
      {isLoading ? (
        <div className="flex-1 flex items-center justify-center text-xs text-[var(--mc-text-muted)]">
          Loading stashes...
        </div>
      ) : entries.length === 0 ? (
        <div className="flex-1 flex items-center justify-center text-xs text-[var(--mc-text-muted)]">
          No stashes
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto">
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
