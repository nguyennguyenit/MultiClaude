import { useState, useRef, useEffect, useCallback } from 'react'

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
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Auto-expand textarea based on content (max ~8 rows)
  const adjustTextareaHeight = useCallback(() => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = Math.min(el.scrollHeight, 160) + 'px'
  }, [])

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

  const handleMessageChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setMessage(e.target.value)
    adjustTextareaHeight()
  }

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

  return (
    <div style={{
      padding: '6px 10px',
      borderBottom: '1px solid var(--mc-border)',
      flexShrink: 0,
    }}>
      {/* Staged file count hint */}
      {stagedCount > 0 && (
        <div className="flex items-center gap-1 mb-1">
          <span style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 4,
            padding: '2px 6px',
            borderRadius: 4,
            fontSize: 10,
            fontWeight: 500,
            background: 'rgba(34,197,94,0.15)',
            color: '#4ade80',
            border: '1px solid rgba(34,197,94,0.2)',
          }}>
            <svg style={{ width: 10, height: 10 }} fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
            </svg>
            {stagedCount} staged
          </span>
        </div>
      )}

      {/* Commit message textarea */}
      <textarea
        ref={textareaRef}
        value={message}
        onChange={handleMessageChange}
        onKeyDown={handleKeyDown}
        placeholder="Commit message..."
        rows={3}
        style={{
          width: '100%',
          padding: '6px 8px',
          fontSize: 11,
          lineHeight: 1.625,
          background: 'var(--mc-bg-primary)',
          border: '1px solid var(--mc-border)',
          borderRadius: 6,
          resize: 'none',
          outline: 'none',
          color: 'inherit',
          fontFamily: 'inherit',
          marginBottom: 6,
          minHeight: 64,
          overflow: 'hidden',
        }}
        disabled={isCommitting}
      />

      {/* Commit button row */}
      <div className="relative flex" ref={dropdownRef}>
        {/* Main commit button */}
        <button
          onClick={handleCommit}
          disabled={!canCommit}
          style={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            padding: '6px 16px',
            fontSize: 12,
            fontWeight: 600,
            borderRadius: '6px 0 0 6px',
            transition: 'all 0.15s ease',
            border: '1px solid',
            borderRight: 'none',
            cursor: canCommit ? 'pointer' : 'not-allowed',
            ...(canCommit
              ? {
                  background: 'var(--mc-accent)',
                  color: 'var(--mc-bg-primary)',
                  borderColor: 'transparent',
                  boxShadow: '0 1px 2px rgba(0,0,0,0.3)',
                }
              : {
                  background: 'var(--mc-bg-secondary)',
                  color: 'var(--mc-text-muted)',
                  opacity: 0.4,
                  borderColor: 'var(--mc-border)',
                }
            ),
          }}
        >
          {isCommitting ? (
            <svg className="animate-spin" style={{ width: 14, height: 14 }} fill="none" viewBox="0 0 24 24">
              <circle style={{ opacity: 0.25 }} cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path style={{ opacity: 0.75 }} fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
          ) : (
            <svg style={{ width: 14, height: 14 }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
            </svg>
          )}
          {isCommitting ? 'Committing…' : 'Commit'}
        </button>

        {/* Dropdown chevron */}
        {onCommitAndPush && (
          <button
            onClick={() => canCommit && setDropdownOpen(prev => !prev)}
            disabled={!canCommit}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '0 10px',
              borderRadius: '0 6px 6px 0',
              transition: 'all 0.15s ease',
              border: '1px solid',
              cursor: canCommit ? 'pointer' : 'not-allowed',
              ...(canCommit
                ? {
                    background: 'var(--mc-accent)',
                    color: 'var(--mc-bg-primary)',
                    borderColor: 'transparent',
                    borderLeft: '1px solid rgba(255,255,255,0.2)',
                  }
                : {
                    background: 'var(--mc-bg-secondary)',
                    color: 'var(--mc-text-muted)',
                    opacity: 0.4,
                    borderColor: 'var(--mc-border)',
                  }
              ),
            }}
            title="More commit options"
          >
            <svg style={{ width: 14, height: 14 }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
        )}

        {/* Dropdown menu */}
        {dropdownOpen && (
          <div style={{
            position: 'absolute',
            bottom: '100%',
            right: 0,
            marginBottom: 4,
            width: 176,
            background: 'var(--mc-bg-secondary)',
            border: '1px solid var(--mc-border)',
            borderRadius: 6,
            boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
            zIndex: 10,
            overflow: 'hidden',
          }}>
            <button
              onClick={handleCommitAndPush}
              style={{
                width: '100%',
                padding: '8px 12px',
                fontSize: 12,
                textAlign: 'left',
                background: 'transparent',
                border: 'none',
                color: 'inherit',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                transition: 'background 0.15s ease',
              }}
              onMouseEnter={e => (e.currentTarget.style.background = 'var(--mc-bg-hover)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
            >
              <svg style={{ width: 12, height: 12, color: 'var(--mc-accent)' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" />
              </svg>
              <span>Commit &amp; Push</span>
              <span style={{ marginLeft: 'auto', fontSize: 10, color: 'var(--mc-text-muted)', fontFamily: 'var(--mc-terminal-font)' }}>⇧⌘↵</span>
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
