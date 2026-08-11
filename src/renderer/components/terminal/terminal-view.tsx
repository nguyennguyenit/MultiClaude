import { useEffect, useRef, memo, CSSProperties, useCallback, useState } from 'react'
import { useTerminal } from '../../hooks/use-terminal'
import { useAppStore, useImageStore } from '../../stores'
import { resolveMediaPathFromLine } from './terminal-image-path-resolver'
import { classifyMediaFile } from '../../utils/media-classifier'
import { processTerminalOutputChunk } from './terminal-output-handler'
import { registerTerminalOutputHandler } from '../../utils/terminal-output-dispatcher'

// Helper to find all image paths in line and return the one at given column
function findImagePathAtColumn(lineText: string, col: number, terminalId: string): { start: number; end: number } | null {
  const matches: { start: number; end: number }[] = []

  // Claude Code reference tokens: [Image #N] for screenshots it auto-attaches,
  // plus legacy [Image N] / [Video N] tokens that still appear in restored
  // terminal buffers from older sessions.
  const tokenRegex = /\[(?:Image(?:\s#)?|Video)\s\d+\]/g
  let match
  while ((match = tokenRegex.exec(lineText)) !== null) {
    matches.push({ start: match.index, end: match.index + match[0].length })
  }

  // Check tracked images
  const trackedImages = useImageStore.getState().getImages(terminalId)
  for (const img of trackedImages) {
    let idx = 0
    while ((idx = lineText.indexOf(img.filePath, idx)) !== -1) {
      matches.push({ start: idx, end: idx + img.filePath.length })
      idx += img.filePath.length
    }
  }

  // Check multiClaude-screenshots paths (all occurrences)
  const screenshotRegex = /[^\s"]*multiClaude-screenshots\/screenshot-\d+\.png/g
  while ((match = screenshotRegex.exec(lineText)) !== null) {
    matches.push({ start: match.index, end: match.index + match[0].length })
  }

  // Check any absolute path to image formats (all occurrences)
  const imageExtRegex = /[/~][^\s"]*\.(?:png|jpg|jpeg|gif|webp|bmp|svg)/gi
  while ((match = imageExtRegex.exec(lineText)) !== null) {
    matches.push({ start: match.index, end: match.index + match[0].length })
  }

  // Check any absolute path to video formats (all occurrences)
  const videoExtRegex = /[/~][^\s"]*\.(?:mp4|mov|avi|mkv|webm|m4v|wmv)/gi
  while ((match = videoExtRegex.exec(lineText)) !== null) {
    matches.push({ start: match.index, end: match.index + match[0].length })
  }

  // Find match that contains the column position
  for (const m of matches) {
    if (col >= m.start && col < m.end) {
      return m
    }
  }

  return null
}

const scrollButtonWrapperStyle: CSSProperties = {
  height: '100%',
  width: '100%',
  position: 'relative',
  containerType: 'size'
}

export interface TerminalRefreshHandle {
  refresh: () => void
  scrollToTop: () => void
  scrollToBottom: () => void
  getViewportSnapshot: () => { viewportY: number | null; isAtBottom: boolean }
}

interface TerminalViewProps {
  terminalId: string
  isActive: boolean
  isDropTarget?: boolean
  hidden?: boolean
  onInputActivity?: () => void
  initialOutput?: string
  initialViewportY?: number | null
  /** Callback to expose fit function to parent for resize handling */
  onFitReady?: (fit: () => void) => void
  /** Callback to expose refresh function to parent for manual refresh */
  onRefreshReady?: (refreshHandle: TerminalRefreshHandle) => void
  /** Callback when terminal receives output - used for streaming detection */
  onOutput?: () => void
}

export const TerminalView = memo(function TerminalView({
  terminalId,
  isActive,
  isDropTarget = false,
  hidden = false,
  onInputActivity,
  initialOutput,
  initialViewportY,
  onFitReady,
  onRefreshReady,
  onOutput
}: TerminalViewProps) {
  const { containerRef, initTerminal, write, fit, focus, blur, showCursor, restoreActiveRender, refresh, scrollToTop, scrollToBottom, getViewportSnapshot, terminalRef, sessionToken } = useTerminal({
    terminalId,
    initialOutput,
    initialViewportY,
    isActive,
    isHidden: hidden
  })
  const appendOutput = useAppStore((state) => state.appendOutput)
  // Skip appending output right after restore to prevent duplicates from shell prompt redraws
  const skipAppendRef = useRef(!!initialOutput)
  const previousHiddenRef = useRef(hidden)

  // Hover highlight state for image path (position within row)
  const [highlightArea, setHighlightArea] = useState<{ top: number; left: number; width: number; height: number } | null>(null)
  const hoverTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Handle mouse move to highlight image path text only
  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const terminal = terminalRef.current
    if (!terminal || !terminal.element) {
      setHighlightArea(null)
      return
    }

    // Clear existing timeout
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current)
    }

    // Debounce hover detection
    hoverTimeoutRef.current = setTimeout(() => {
      const term = terminalRef.current
      if (!term || !term.element) return

      // Get xterm-screen element for accurate positioning (accounts for padding)
      const screenEl = term.element.querySelector('.xterm-screen') as HTMLElement | null
      if (!screenEl) return

      const screenRect = screenEl.getBoundingClientRect()
      const wrapperRect = term.element.getBoundingClientRect()
      const x = e.clientX - screenRect.left
      const y = e.clientY - screenRect.top
      const cellWidth = screenRect.width / term.cols
      const cellHeight = screenRect.height / term.rows
      const col = Math.floor(x / cellWidth)
      const row = Math.floor(y / cellHeight)

      // Calculate offset of screen element within wrapper
      const screenOffsetLeft = screenRect.left - wrapperRect.left
      const screenOffsetTop = screenRect.top - wrapperRect.top

      const buffer = term.buffer.active
      const absoluteRow = buffer.viewportY + row
      const line = buffer.getLine(absoluteRow)

      if (!line) {
        setHighlightArea(null)
        return
      }

      // Extract text from line
      let lineText = ''
      for (let i = 0; i < line.length; i++) {
        lineText += line.getCell(i)?.getChars() || ''
      }
      lineText = lineText.trimEnd()

      const pathPos = findImagePathAtColumn(lineText, col, terminalId)

      // Highlight if mouse is within an image path
      if (pathPos) {
        setHighlightArea({
          top: screenOffsetTop + row * cellHeight,
          left: screenOffsetLeft + pathPos.start * cellWidth,
          width: (pathPos.end - pathPos.start) * cellWidth,
          height: cellHeight
        })
      } else {
        setHighlightArea(null)
      }
    }, 50)
  }, [terminalRef, terminalId])

  // Clear highlight on mouse leave
  const handleMouseLeave = useCallback(() => {
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current)
    }
    setHighlightArea(null)
  }, [])

  // Media click (image: image.open, video: media.open)
  const handleMediaClick = useCallback(async (e: React.MouseEvent<HTMLDivElement>) => {
    const terminal = terminalRef.current
    if (!terminal || !terminal.element) return

    // Get mouse position relative to terminal
    const rect = terminal.element.getBoundingClientRect()
    const y = e.clientY - rect.top

    // Get terminal cell dimensions
    const cellHeight = rect.height / terminal.rows

    // Calculate row
    const row = Math.floor(y / cellHeight)

    // Get current viewport offset
    const buffer = terminal.buffer.active
    const absoluteRow = buffer.viewportY + row

    // Get line at this row
    const line = buffer.getLine(absoluteRow)
    if (!line) return

    // Extract text from line
    let lineText = ''
    for (let i = 0; i < line.length; i++) {
      lineText += line.getCell(i)?.getChars() || ''
    }
    lineText = lineText.trimEnd()

    const imageStore = useImageStore.getState()
    const trackedImages = imageStore.getImages(terminalId)

    let foundPath = resolveMediaPathFromLine({
      lineText,
      trackedImages
    })

    if (!foundPath && lineText.includes('[Image #')) {
      const screenshotPaths = await window.electron.image.listScreenshots()
      foundPath = resolveMediaPathFromLine({
        lineText,
        trackedImages,
        screenshotPaths
      })
    }

    if (foundPath) {
      const kind = classifyMediaFile(foundPath)
      if (kind === 'video') {
        window.electron.media.open(foundPath)
      } else {
        window.electron.image.open(foundPath)
      }
    }
  }, [terminalRef, terminalId])

  // Handle click on terminal - force show cursor in case it was hidden by CLI.
  // Focus unconditionally: click implies user intent to interact with this pane.
  // Gating on isActive used stale prop from previous render, so clicks switching
  // panes left DOM focus on the old textarea — Cmd+V then routed pastes to the
  // wrong pane.
  const handleTerminalClick = (e: React.MouseEvent<HTMLDivElement>) => {
    focus()
    showCursor()
    handleMediaClick(e)
  }

  const handleKeyDownCapture = useCallback((e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Shift' || e.key === 'Control' || e.key === 'Alt' || e.key === 'Meta') {
      return
    }
    onInputActivity?.()
  }, [onInputActivity])

  const handleBeforeInputCapture = useCallback(() => {
    onInputActivity?.()
  }, [onInputActivity])

  const handlePasteCapture = useCallback(() => {
    onInputActivity?.()
  }, [onInputActivity])

  const handleCompositionStartCapture = useCallback(() => {
    onInputActivity?.()
  }, [onInputActivity])

  // Initialize terminal on mount
  useEffect(() => {
    initTerminal()
  }, [initTerminal])

  // Cleanup hover timeout on unmount
  useEffect(() => {
    return () => {
      if (hoverTimeoutRef.current) {
        clearTimeout(hoverTimeoutRef.current)
      }
    }
  }, [])

  // After terminal init settles, allow appending output (for restore case)
  // 500ms delay ensures xterm finishes restoring output before we start appending new data
  // This prevents duplicate shell prompts when switching tabs during terminal restore
  useEffect(() => {
    if (!skipAppendRef.current) return
    const timer = setTimeout(() => {
      skipAppendRef.current = false
    }, 500)
    return () => clearTimeout(timer)
  }, [])

  // Listen for terminal output via the shared app-level dispatcher
  useEffect(() => {
    return registerTerminalOutputHandler(terminalId, (data) => {
      processTerminalOutputChunk({
        terminalId,
        data,
        write,
        onOutput,
        skipAppend: skipAppendRef.current,
        appendOutput
      })
    }, () => refresh(false), sessionToken)
  }, [terminalId, write, appendOutput, onOutput, refresh, sessionToken])

  // Focus when becomes active, blur when inactive
  // Note: scroll restoration and cursor are handled by visibility effect in use-terminal.ts
  useEffect(() => {
    const becameVisible = previousHiddenRef.current && !hidden
    previousHiddenRef.current = hidden

    if (isActive && !hidden) {
      focus()
      // The visibility hook repaints once after a project reveal. Repaint here
      // only for pane activation inside an already-visible project.
      if (!becameVisible) restoreActiveRender()
      // Delayed cursor restore to handle WebGL reload timing
      const timer = setTimeout(() => {
        showCursor()
      }, 100)
      return () => clearTimeout(timer)
    } else {
      blur()
    }
  }, [isActive, hidden, focus, blur, showCursor, restoreActiveRender])

  useEffect(() => {
    if (!isActive) return

    const handleWindowFocus = () => {
      focus()
      restoreActiveRender()
      showCursor()
    }

    window.addEventListener('focus', handleWindowFocus)
    return () => window.removeEventListener('focus', handleWindowFocus)
  }, [isActive, focus, restoreActiveRender, showCursor])

  // Expose fit function to parent for resize handling
  useEffect(() => {
    onFitReady?.(fit)
  }, [fit, onFitReady])

  // Expose refresh function to parent for manual refresh
  useEffect(() => {
    onRefreshReady?.({
      refresh: () => refresh(),
      scrollToTop,
      scrollToBottom,
      getViewportSnapshot
    })
  }, [refresh, scrollToTop, scrollToBottom, getViewportSnapshot, onRefreshReady])

  return (
    <div
      className="terminal-container-wrapper"
      style={scrollButtonWrapperStyle}
      onClick={handleTerminalClick}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      onKeyDownCapture={handleKeyDownCapture}
      onBeforeInputCapture={handleBeforeInputCapture}
      onPasteCapture={handlePasteCapture}
      onCompositionStartCapture={handleCompositionStartCapture}
    >
      <div
        ref={containerRef}
        className={`terminal-container${highlightArea ? ' image-hover' : ''}${isDropTarget ? ' terminal-drop-active' : ''}`}
        style={{ height: '100%', width: '100%' }}
      />

      {isDropTarget && (
        <div className="terminal-drop-overlay pointer-events-none absolute inset-2" />
      )}

      {/* Hover underline for image path text */}
      {highlightArea && (
        <div
          className="pointer-events-none absolute bg-white/70 transition-opacity duration-100"
          style={{
            top: highlightArea.top + highlightArea.height - 2,
            left: highlightArea.left,
            width: highlightArea.width,
            height: 1
          }}
        />
      )}

    </div>
  )
})
