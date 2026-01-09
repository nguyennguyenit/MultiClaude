import { useEffect, useRef, useCallback, memo, useState } from 'react'
import { TerminalView } from './terminal-view'

interface TerminalPaneProps {
  terminalId: string
  title: string
  isActive: boolean
  isClaudeMode?: boolean
  initialOutput?: string
  onActivate: () => void
  onClose: () => void
  onTitleChange?: (newTitle: string) => void
  onInsertFilePath?: (paths: string[]) => void
}

/** Wrapper for TerminalView with header bar, resize handling, and focus indicator */
export const TerminalPane = memo(function TerminalPane({
  terminalId,
  title,
  isActive,
  isClaudeMode = false,
  initialOutput,
  onActivate,
  onClose,
  onTitleChange,
  onInsertFilePath
}: TerminalPaneProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const resizeTimeoutRef = useRef<number | undefined>(undefined)
  const terminalFitRef = useRef<(() => void) | null>(null)
  const terminalRefreshRef = useRef<(() => void) | null>(null)
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

  // Store refresh callback from TerminalView
  const handleTerminalRefresh = useCallback((refreshFn: () => void) => {
    terminalRefreshRef.current = refreshFn
  }, [])

  // Handle refresh button click
  const handleRefreshClick = useCallback(() => {
    terminalRefreshRef.current?.()
  }, [])

  // File picker handler
  const handleInsertFilePath = useCallback(async () => {
    const paths = await window.electron.filePicker.open()
    if (paths && paths.length > 0) {
      onInsertFilePath?.(paths)
    }
  }, [onInsertFilePath])

  // Keyboard shortcut for file picker (Ctrl+Shift+I)
  useEffect(() => {
    if (!isActive) return

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.shiftKey && e.key === 'I') {
        e.preventDefault()
        handleInsertFilePath()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isActive, handleInsertFilePath])

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

        {/* Insert file path button */}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            handleInsertFilePath()
          }}
          className="p-0.5 hover:bg-[var(--mc-bg-hover)] rounded text-[var(--mc-text-muted)] hover:text-[var(--mc-text-primary)]"
          title="Insert file path (Ctrl+Shift+I)"
          aria-label="Insert file path"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 13h6m-3-3v6m5 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
        </button>

        {/* Refresh terminal display button */}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            handleRefreshClick()
          }}
          className="p-0.5 hover:bg-[var(--mc-bg-hover)] rounded text-[var(--mc-text-muted)] hover:text-[var(--mc-text-primary)]"
          title="Refresh terminal display"
          aria-label="Refresh terminal display"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
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
          initialOutput={initialOutput}
          onFitReady={handleTerminalFit}
          onRefreshReady={handleTerminalRefresh}
        />
      </div>
    </div>
  )
})
