import { useState, useRef, useEffect } from 'react'

interface CommitFormProps {
  stagedCount: number
  onCommit: (message: string) => Promise<boolean>
  onCommitAndPush?: (message: string) => Promise<boolean>
}

export function CommitForm({ stagedCount, onCommit, onCommitAndPush }: CommitFormProps) {
  const [message, setMessage] = useState('')
  const [isCommitting, setIsCommitting] = useState(false)
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const canCommit = !!message.trim() && stagedCount > 0 && !isCommitting

  const handleCommit = async () => {
    if (!canCommit) return
    setIsCommitting(true)
    const success = await onCommit(message)
    setIsCommitting(false)
    if (success) setMessage('')
  }

  const handleCommitAndPush = async () => {
    if (!canCommit || !onCommitAndPush) return
    setDropdownOpen(false)
    setIsCommitting(true)
    const success = await onCommitAndPush(message)
    setIsCommitting(false)
    if (success) setMessage('')
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      if (e.shiftKey) {
        handleCommitAndPush()
      } else {
        handleCommit()
      }
    }
  }

  const buttonBase = `
    flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-semibold transition-all
    ${canCommit
      ? 'bg-[var(--mc-accent)] text-[var(--mc-bg-primary)] hover:opacity-90'
      : 'bg-[var(--mc-bg-secondary)] text-[var(--mc-text-muted)] opacity-50 cursor-not-allowed'
    }
  `

  return (
    <div className="px-3 py-1.5 border-b border-[var(--mc-border)] bg-[var(--mc-bg-secondary)]/50">
      <textarea
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Commit message..."
        rows={2}
        className="w-full px-2 py-1 text-[11px] bg-[var(--mc-bg-primary)] border border-[var(--mc-border)] rounded resize-none focus:outline-none focus:border-[var(--mc-accent)] placeholder-[var(--mc-text-muted)] mb-1.5"
        disabled={isCommitting}
      />

      {/* Split commit button */}
      <div className="relative flex" ref={dropdownRef}>
        {/* Main commit button */}
        <button
          onClick={handleCommit}
          disabled={!canCommit}
          className={`${buttonBase} flex-1 rounded-l`}
        >
          {isCommitting ? (
            <svg className="animate-spin w-3 h-3" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
          ) : (
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          )}
          Commit {stagedCount > 0 ? `(${stagedCount})` : ''}
        </button>

        {/* Dropdown chevron */}
        {onCommitAndPush && (
          <button
            onClick={() => canCommit && setDropdownOpen(prev => !prev)}
            disabled={!canCommit}
            className={`${buttonBase} px-2 border-l border-[var(--mc-bg-primary)]/30 rounded-r`}
            title="More commit options"
          >
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
        )}

        {/* Dropdown menu */}
        {dropdownOpen && (
          <div className="absolute bottom-full right-0 mb-1 w-40 bg-[var(--mc-bg-secondary)] border border-[var(--mc-border)] rounded shadow-lg z-10">
            <button
              onClick={handleCommitAndPush}
              className="w-full px-3 py-2 text-xs text-left hover:bg-[var(--mc-bg-hover)] flex items-center gap-2"
            >
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" />
              </svg>
              Commit &amp; Push
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
