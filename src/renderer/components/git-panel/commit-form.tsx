import { useState } from 'react'

interface CommitFormProps {
  stagedCount: number
  onCommit: (message: string) => Promise<boolean>
}

export function CommitForm({ stagedCount, onCommit }: CommitFormProps) {
  const [message, setMessage] = useState('')
  const [isCommitting, setIsCommitting] = useState(false)

  const handleCommit = async () => {
    if (!message.trim() || stagedCount === 0) return
    setIsCommitting(true)
    const success = await onCommit(message)
    setIsCommitting(false)
    if (success) {
      setMessage('')
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      handleCommit()
    }
  }

  return (
    <div className="border-t border-[var(--mc-border)] p-3 bg-[var(--mc-bg-tertiary)]/30 backdrop-blur-sm">
      <div className="relative group">
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Commit message..."
          className="w-full h-24 px-3 py-2 text-xs bg-[var(--mc-bg-primary)] border border-[var(--mc-border)] rounded-md resize-none focus:outline-none focus:border-[var(--mc-accent)] focus:ring-1 focus:ring-[var(--mc-accent)] transition-all placeholder-[var(--mc-text-muted)]"
          disabled={isCommitting}
        />
        <div className="absolute bottom-2 right-2 flex items-center gap-1.5 z-10">
          <span className="text-[9px] text-[var(--mc-text-muted)] opacity-0 group-focus-within:opacity-100 transition-opacity bg-[var(--mc-bg-primary)] px-1 rounded border border-[var(--mc-border)]">
            ⌘/Ctrl + Enter
          </span>
        </div>
      </div>

      <button
        onClick={handleCommit}
        disabled={!message.trim() || stagedCount === 0 || isCommitting}
        className={`
          w-full mt-2 px-3 py-2 text-xs font-semibold rounded-md flex items-center justify-center gap-2 transition-all
          ${(!message.trim() || stagedCount === 0)
            ? 'bg-[var(--mc-bg-secondary)] text-[var(--mc-text-muted)] opacity-50 cursor-not-allowed'
            : 'bg-[var(--mc-accent)] text-[var(--mc-bg-primary)] hover:opacity-90 shadow-md transform active:scale-98'
          }
        `}
      >
        {isCommitting ? (
          <>
            <svg className="animate-spin w-3 h-3" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            Committing...
          </>
        ) : (
          <>
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            Commit {stagedCount > 0 ? `(${stagedCount})` : ''}
          </>
        )}
      </button>
    </div>
  )
}
