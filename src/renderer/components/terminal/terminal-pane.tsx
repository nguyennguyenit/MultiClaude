import { useEffect, useRef, useCallback, memo, useState } from 'react'
import { TerminalView } from './terminal-view'

interface TerminalPaneProps {
  terminalId: string
  title: string
  isActive: boolean
  isClaudeMode?: boolean
  onActivate: () => void
  onClose: () => void
  onStartClaude: () => void
  onTitleChange?: (newTitle: string) => void
}

/** Wrapper for TerminalView with header bar, resize handling, and focus indicator */
export const TerminalPane = memo(function TerminalPane({
  terminalId,
  title,
  isActive,
  isClaudeMode = false,
  onActivate,
  onClose,
  onStartClaude,
  onTitleChange
}: TerminalPaneProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const resizeTimeoutRef = useRef<number | undefined>(undefined)
  const terminalFitRef = useRef<(() => void) | null>(null)
  const [isEditing, setIsEditing] = useState(false)
  const [editTitle, setEditTitle] = useState(title)

  // Sync editTitle when title prop changes externally
  useEffect(() => {
    if (!isEditing) {
      setEditTitle(title)
    }
  }, [title, isEditing])

  // Store fit callback from TerminalView
  const handleTerminalFit = useCallback((fitFn: () => void) => {
    terminalFitRef.current = fitFn
  }, [])

  // Debounced fit on container resize
  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const resizeObserver = new ResizeObserver(() => {
      // Debounce fit calls during resize drag
      if (resizeTimeoutRef.current) {
        clearTimeout(resizeTimeoutRef.current)
      }
      resizeTimeoutRef.current = window.setTimeout(() => {
        terminalFitRef.current?.()
      }, 100)
    })

    resizeObserver.observe(container)

    return () => {
      resizeObserver.disconnect()
      if (resizeTimeoutRef.current) {
        clearTimeout(resizeTimeoutRef.current)
      }
    }
  }, [])

  return (
    <div
      ref={containerRef}
      onClick={onActivate}
      className={`terminal-pane h-full w-full flex flex-col ${isActive ? 'terminal-pane-active' : ''}`}
    >
      {/* Header bar */}
      <div className="flex items-center h-6 px-2 bg-[var(--mc-bg-tertiary)] border-b border-[var(--mc-border)] flex-shrink-0">
        {/* Title - editable on double-click */}
        {isEditing ? (
          <input
            type="text"
            value={editTitle}
            onChange={(e) => setEditTitle(e.target.value)}
            onBlur={() => {
              setIsEditing(false)
              if (editTitle !== title) {
                onTitleChange?.(editTitle)
              }
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                setIsEditing(false)
                if (editTitle !== title) {
                  onTitleChange?.(editTitle)
                }
              } else if (e.key === 'Escape') {
                setEditTitle(title) // Reset to original
                setIsEditing(false)
              }
            }}
            autoFocus
            className="flex-1 text-xs bg-transparent border-none outline-none text-[var(--mc-text-primary)]"
          />
        ) : (
          <span
            className="flex-1 text-xs truncate text-[var(--mc-text-secondary)] cursor-default"
            onDoubleClick={() => setIsEditing(true)}
            title="Double-click to rename"
          >
            {title}
          </span>
        )}

        {/* Claude mode indicator */}
        {isClaudeMode && (
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-[var(--mc-accent)] text-[var(--mc-bg-primary)] mr-1">
            Claude
          </span>
        )}

        {/* Start Claude button */}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            onStartClaude()
          }}
          className="p-0.5 hover:bg-[var(--mc-bg-hover)] rounded text-[var(--mc-text-muted)] hover:text-[var(--mc-accent)]"
          title="Start Claude"
          aria-label="Start Claude"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
        </button>

        {/* Close button */}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            onClose()
          }}
          className="p-0.5 hover:bg-[var(--mc-bg-hover)] rounded text-[var(--mc-text-muted)] hover:text-red-500 ml-1"
          title="Close terminal"
          aria-label="Close terminal"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Terminal content */}
      <div className="flex-1 min-h-0">
        <TerminalView
          terminalId={terminalId}
          isActive={isActive}
          onFitReady={handleTerminalFit}
        />
      </div>
    </div>
  )
})
