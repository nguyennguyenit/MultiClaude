import { useEffect, useRef, useCallback, memo, useState, useMemo } from 'react'
import { TerminalView, type TerminalRefreshHandle } from './terminal-view'
import { useFileDrop } from '../../hooks/use-file-drop'
import { clearPendingDropTerminal, setPendingDropTerminal } from '../../utils/file-drop-handler'
import { useAppStore } from '../../stores'
import { AGENT_BADGE_COLORS, AGENT_BADGE_TEXT, AGENT_DISPLAY_NAMES } from '@shared/constants/notification'
import type { AgentType } from '@shared/types'

// Streaming detection constants
const STREAMING_IDLE_THRESHOLD = 300  // ms - consider idle after no output for this duration
const STREAMING_FIT_DELAY = 500       // ms - delay fit during streaming to avoid reflow duplicates

interface TerminalPaneProps {
  terminalId: string
  title: string
  isActive: boolean
  hidden?: boolean
  isClaudeMode?: boolean
  agentType?: AgentType
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
  agentType,
  initialOutput,
  onActivate,
  onClose,
  onTitleChange,
  onInsertFilePath
}: TerminalPaneProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const resizeTimeoutRef = useRef<number | undefined>(undefined)
  const terminalFitRef = useRef<(() => void) | null>(null)
  const terminalRefreshRef = useRef<TerminalRefreshHandle | null>(null)
  const lastOutputTimeRef = useRef<number>(0)
  const [isEditing, setIsEditing] = useState(false)
  const [editTitle, setEditTitle] = useState(title)
  const restoredInitialOutput = useMemo(
    () => initialOutput ?? useAppStore.getState().getTerminalOutput(terminalId),
    [initialOutput, terminalId]
  )

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
  const handleTerminalRefresh = useCallback((refreshHandle: TerminalRefreshHandle) => {
    terminalRefreshRef.current = refreshHandle
  }, [])

  const handleFileDropStateChange = useCallback((dragging: boolean) => {
    if (dragging) {
      setPendingDropTerminal(terminalId)
    } else {
      clearPendingDropTerminal(terminalId)
    }
  }, [terminalId])

  const handleFileDrop = useCallback((paths: string[]) => {
    setPendingDropTerminal(terminalId)
    onInsertFilePath?.(paths)
    clearPendingDropTerminal(terminalId)
  }, [terminalId, onInsertFilePath])

  const { isDragOver, dropHandlers } = useFileDrop({
    onDrop: handleFileDrop,
    onDragStateChange: handleFileDropStateChange
  })

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

  const handleRefreshClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    terminalRefreshRef.current?.refresh()
  }, [])

  const handleScrollToTopClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    terminalRefreshRef.current?.scrollToTop()
  }, [])

  const handleScrollToBottomClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    terminalRefreshRef.current?.scrollToBottom()
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
      data-terminal-id={terminalId}
      onClick={onActivate}
      {...dropHandlers}
      style={{ display: 'flex', flexDirection: 'column', height: '100%', width: '100%' }}
    >
      {/* Top tab bar */}
      <div className={`pane-tab-bar${isActive ? ' active' : ''}`}>
        <div className={`pane-tab${isActive ? ' active' : ''}`}>
          {/* Agent mode badge — shows for any detected agent (claude=AI, codex=CX, gemini=GM, aider=AD) */}
          {(agentType || isClaudeMode) && (() => {
            const type: AgentType = agentType ?? 'claude'
            return (
              <span
                className="pane-tab-agent-badge"
                style={{ backgroundColor: AGENT_BADGE_COLORS[type] }}
                title={AGENT_DISPLAY_NAMES[type]}
              >
                {AGENT_BADGE_TEXT[type]}
              </span>
            )
          })()}

          <div className="pane-tab-title-group">
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
                className="pane-tab-name pane-tab-name-input"
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
          </div>

          <div className="pane-tab-actions">
            {/* Scroll buttons */}
            <button
              type="button"
              onClick={handleScrollToTopClick}
              className="pane-tab-action"
              title="Scroll to top"
              aria-label="Scroll to top"
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M18 15l-6-6-6 6" />
              </svg>
            </button>

            <button
              type="button"
              onClick={handleScrollToBottomClick}
              className="pane-tab-action"
              title="Scroll to bottom"
              aria-label="Scroll to bottom"
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 9l6 6 6-6" />
              </svg>
            </button>

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
              onClick={handleRefreshClick}
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
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* Terminal content - takes remaining space */}
      <div style={{ flex: 1, minHeight: 0 }}>
        <TerminalView
          terminalId={terminalId}
          isActive={isActive}
          isDropTarget={isDragOver}
          hidden={hidden}
          onInputActivity={onActivate}
          initialOutput={restoredInitialOutput}
          onFitReady={handleTerminalFit}
          onRefreshReady={handleTerminalRefresh}
          onOutput={handleTerminalOutput}
        />
      </div>
    </div>
  )
})
