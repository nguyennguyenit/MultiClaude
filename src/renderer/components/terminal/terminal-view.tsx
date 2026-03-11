import { useEffect, useRef, memo, CSSProperties, useCallback, useState } from 'react'
import { useTerminal } from '../../hooks/use-terminal'
import { useAppStore, useImageStore } from '../../stores'

// Helper to find all image paths in line and return the one at given column
function findImagePathAtColumn(lineText: string, col: number, terminalId: string): { start: number; end: number } | null {
  const matches: { start: number; end: number }[] = []

  // Check [Image #X] patterns (all occurrences)
  const imageRefRegex = /\[Image #\d+\]/g
  let match
  while ((match = imageRefRegex.exec(lineText)) !== null) {
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

interface TerminalViewProps {
  terminalId: string
  isActive: boolean
  hidden?: boolean
  initialOutput?: string
  /** Callback to expose fit function to parent for resize handling */
  onFitReady?: (fit: () => void) => void
  /** Callback to expose refresh function to parent for manual refresh */
  onRefreshReady?: (refresh: () => void) => void
  /** Callback when terminal receives output - used for streaming detection */
  onOutput?: () => void
}

export const TerminalView = memo(function TerminalView({ terminalId, isActive, hidden = false, initialOutput, onFitReady, onRefreshReady, onOutput }: TerminalViewProps) {
  const { containerRef, initTerminal, write, fit, focus, blur, showCursor, refresh, terminalRef } = useTerminal({
    terminalId,
    initialOutput,
    isActive,
    isHidden: hidden
  })
  const appendOutput = useAppStore((state) => state.appendOutput)
  // Skip appending output right after restore to prevent duplicates from shell prompt redraws
  const skipAppendRef = useRef(!!initialOutput)

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

  // Image preview popup state
  const handleImageClick = useCallback(async (e: React.MouseEvent<HTMLDivElement>) => {
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

    let foundPath: string | null = null

    // Priority 1: Check for [Image #X] pattern (Claude Code format)
    const imageRefRegex = /\[Image #(\d+)\]/g
    const imageRefMatch = imageRefRegex.exec(lineText)
    if (imageRefMatch) {
      const imageIndex = parseInt(imageRefMatch[1], 10)
      const screenshots = await window.electron.image.listScreenshots()
      if (screenshots.length >= imageIndex) {
        foundPath = screenshots[imageIndex - 1]
      }
    }

    // Priority 2: Check tracked images
    if (!foundPath) {
      const imageStore = useImageStore.getState()
      const trackedImages = imageStore.getImages(terminalId)
      for (const img of trackedImages) {
        if (lineText.includes(img.filePath)) {
          foundPath = img.filePath
          break
        }
      }
    }

    // Fallback 1: multiClaude-screenshots paths
    if (!foundPath) {
      const screenshotRegex = /"?([^\s"]*multiClaude-screenshots\/screenshot-\d+\.png)"?/g
      const screenshotMatch = screenshotRegex.exec(lineText)
      if (screenshotMatch) {
        foundPath = screenshotMatch[1]
      }
    }

    // Fallback 2: Any absolute path to common image formats
    if (!foundPath) {
      const imageExtRegex = /"?([/~][^\s"]*\.(?:png|jpg|jpeg|gif|webp|bmp|svg))"?/gi
      const extMatch = imageExtRegex.exec(lineText)
      if (extMatch) {
        foundPath = extMatch[1]
      }
    }

    // Open image in external viewer if found
    if (foundPath) {
      window.electron.image.open(foundPath)
    }
  }, [terminalRef, terminalId])

  // Handle click on terminal - force show cursor in case it was hidden by CLI
  const handleTerminalClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (isActive) {
      focus()
      showCursor()
    }
    // Check if clicked on image path
    handleImageClick(e)
  }

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

  // Listen for terminal output
  useEffect(() => {
    const unsubscribe = window.electron.terminal.onOutput(({ terminalId: id, data }) => {
      if (id === terminalId) {
        write(data)
        // Notify parent of output for streaming detection
        onOutput?.()
        // Skip appending during restore period to prevent duplicate prompts
        if (!skipAppendRef.current) {
          appendOutput(terminalId, data)
        }
      }
    })
    return unsubscribe
  }, [terminalId, write, appendOutput, onOutput])

  // Focus when becomes active, blur when inactive
  // Note: scroll restoration and cursor are handled by visibility effect in use-terminal.ts
  useEffect(() => {
    if (isActive) {
      focus()
      // Delayed cursor restore to handle WebGL reload timing
      const timer = setTimeout(() => {
        showCursor()
      }, 100)
      return () => clearTimeout(timer)
    } else {
      blur()
    }
  }, [isActive, focus, blur, showCursor])

  // Expose fit function to parent for resize handling
  useEffect(() => {
    onFitReady?.(fit)
  }, [fit, onFitReady])

  // Expose refresh function to parent for manual refresh
  useEffect(() => {
    onRefreshReady?.(refresh)
  }, [refresh, onRefreshReady])

  return (
    <div
      className="terminal-container-wrapper"
      style={scrollButtonWrapperStyle}
      onClick={handleTerminalClick}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
    >
      <div
        ref={containerRef}
        className={`terminal-container${highlightArea ? ' image-hover' : ''}`}
        style={{ height: '100%', width: '100%' }}
      />

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
