import { useEffect, useRef, useCallback, memo, useState } from 'react'
import { TerminalView } from './terminal-view'

// Streaming detection constants
const STREAMING_IDLE_THRESHOLD = 300  // ms - consider idle after no output for this duration
const STREAMING_FIT_DELAY = 500       // ms - delay fit during streaming to avoid reflow duplicates

interface TerminalPaneProps {
  terminalId: string
  title: string
  isActive: boolean
  hidden?: boolean
  isClaudeMode?: boolean
  initialOutput?: string
  onActivate: () => void
  onClose: () => void
  onTitleChange?: (newTitle: string) => void
  onInsertFilePath?: (paths: string[]) => void
}

/** Wrapper for TerminalView with bottom tab bar, resize handling, and focus indicator */
export const TerminalPane = memo(function TerminalPane({
  terminalId,
  title,
  isActive,
  hidden = false,
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
  const lastOutputTimeRef = useRef<number>(0)
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

  // Track output for streaming detection
  const handleTerminalOutput = useCallback(() => {
    lastOutputTimeRef.current = Date.now()
  }, [])

  // File picker handler
  const handleInsertFilePath = useCallback(async (e: React.MouseEvent) => {
    e.stopPropagation()
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
        window.electron.filePicker.open().then(paths => {
          if (paths && paths.length > 0) onInsertFilePath?.(paths)
        })
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isActive, onInsertFilePath])

  // Debounced fit on container resize - defers during streaming to avoid reflow duplicates
  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const resizeObserver = new ResizeObserver(() => {
      if (resizeTimeoutRef.current) clearTimeout(resizeTimeoutRef.current)

      const timeSinceLastOutput = Date.now() - lastOutputTimeRef.current
      const isStreaming = timeSinceLastOutput < STREAMING_IDLE_THRESHOLD
      const delay = isStreaming ? STREAMING_FIT_DELAY : 100

      resizeTimeoutRef.current = window.setTimeout(() => {
        const currentTimeSinceOutput = Date.now() - lastOutputTimeRef.current
        if (currentTimeSinceOutput < STREAMING_IDLE_THRESHOLD) {
          resizeTimeoutRef.current = window.setTimeout(() => {
            terminalFitRef.current?.()
          }, STREAMING_FIT_DELAY)
          return
        }
        terminalFitRef.current?.()
      }, delay)
    })

    resizeObserver.observe(container)
    return () => {
      resizeObserver.disconnect()
      if (resizeTimeoutRef.current) clearTimeout(resizeTimeoutRef.current)
    }
  }, [])

  const commitTitle = useCallback(() => {
    setIsEditing(false)
    if (editTitle !== title) {
      onTitleChange?.(editTitle)
    }
  }, [editTitle, title, onTitleChange])

  return (
    <div
      ref={containerRef}
      onClick={onActivate}
      style={{ display: 'flex', flexDirection: 'column', height: '100%', width: '100%' }}
    >
      {/* Top tab bar */}
      <div className={`pane-tab-bar`}>
        <div className={`pane-tab active`}>
          {/* Claude mode badge */}
          {isClaudeMode && <span className="pane-tab-claude">AI</span>}

          {/* Title - editable on double-click */}
          {isEditing ? (
            <input
              type="text"
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)}
              onBlur={commitTitle}
              onKeyDown={(e) => {
                if (e.key === 'Enter') commitTitle()
                else if (e.key === 'Escape') {
                  setEditTitle(title)
                  setIsEditing(false)
                }
                e.stopPropagation()
              }}
              onClick={(e) => e.stopPropagation()}
              autoFocus
              className="pane-tab-name"
              style={{ cursor: 'text' }}
            />
          ) : (
            <span
              className="pane-tab-name"
              onDoubleClick={(e) => { e.stopPropagation(); setIsEditing(true) }}
              title="Double-click to rename"
            >
              {title}
            </span>
          )}

          {/* Rename terminal button */}
          {!isEditing && (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); setIsEditing(true) }}
              className="pane-tab-action"
              title="Rename terminal"
              aria-label="Rename terminal"
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
            </button>
          )}

          {/* Insert file path button */}
          <button
            type="button"
            onClick={handleInsertFilePath}
            className="pane-tab-action"
            title="Insert file path (Ctrl+Shift+I)"
            aria-label="Insert file path"
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 13h6m-3-3v6m5 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </button>

          {/* Refresh terminal display button */}
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); terminalRefreshRef.current?.() }}
            className="pane-tab-action"
            title="Refresh terminal display"
            aria-label="Refresh terminal display"
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </button>

          {/* Close button */}
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onClose() }}
            className="pane-tab-close"
            title="Close terminal"
            aria-label="Close terminal"
          >
            ×
          </button>
        </div>
      </div>

      {/* Terminal content - takes remaining space */}
      <div style={{ flex: 1, minHeight: 0 }}>
        <TerminalView
          terminalId={terminalId}
          isActive={isActive}
          hidden={hidden}
          initialOutput={initialOutput}
          onFitReady={handleTerminalFit}
          onRefreshReady={handleTerminalRefresh}
          onOutput={handleTerminalOutput}
        />
      </div>
    </div>
  )
})
