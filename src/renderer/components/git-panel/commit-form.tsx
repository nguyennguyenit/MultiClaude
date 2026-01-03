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
    <div className="border-t border-[var(--mc-border)] p-2">
      <textarea
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Commit message..."
        className="w-full h-16 px-2 py-1 text-xs bg-[var(--mc-bg-hover)] rounded resize-none"
        disabled={isCommitting}
      />
      <button
        onClick={handleCommit}
        disabled={!message.trim() || stagedCount === 0 || isCommitting}
        className="w-full mt-2 px-3 py-1.5 text-xs bg-[var(--mc-accent)] text-[var(--mc-bg-primary)] rounded disabled:opacity-50"
      >
        {isCommitting ? 'Committing...' : `Commit (${stagedCount})`}
      </button>
      <div className="text-[10px] text-[var(--mc-text-muted)] mt-1 text-center">
        Ctrl+Enter to commit
      </div>
    </div>
  )
}
