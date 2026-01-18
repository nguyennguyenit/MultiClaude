import { useEffect, useRef, memo, CSSProperties, useState, useCallback } from 'react'
import { useTerminal } from '../../hooks/use-terminal'
import { useAppStore, useSettingsStore, useImageStore } from '../../stores'
import { ImagePreviewPopup } from './image-preview-popup'

// Responsive scroll button styles using CSS Container Queries
// Button scales 3-4% of terminal width, bounded 20-32px
const scrollButtonWrapperStyle: CSSProperties = {
  height: '100%',
  width: '100%',
  position: 'relative',
  containerType: 'size'
}

const scrollButtonStyle: CSSProperties = {
  width: 'clamp(20px, 4cqw, 32px)',
  height: 'clamp(20px, 4cqw, 32px)',
  padding: 'clamp(4px, 1cqw, 8px)'
}

const scrollButtonIconStyle: CSSProperties = {
  width: 'clamp(12px, 2cqw, 16px)',
  height: 'clamp(12px, 2cqw, 16px)'
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
  const { containerRef, initTerminal, write, fit, focus, blur, showCursor, scrollToBottom, isAtBottom, refresh, terminalRef } = useTerminal({
    terminalId,
    initialOutput,
    isActive,
    isHidden: hidden
  })
  const appendOutput = useAppStore((state) => state.appendOutput)
  const settingsModalOpen = useSettingsStore((state) => state.settingsModalOpen)
  // Skip appending output right after restore to prevent duplicates from shell prompt redraws
  const skipAppendRef = useRef(!!initialOutput)

  // Image preview popup state
  const [hoveredImage, setHoveredImage] = useState<string | null>(null)
  const [popupPosition, setPopupPosition] = useState<{ x: number; y: number } | null>(null)
  const hoverTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const removeImage = useImageStore((state) => state.removeImage)

  // Handle mouse move on terminal to detect hover on image paths
  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const terminal = terminalRef.current
    if (!terminal) return

    // Clear existing timeout
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current)
    }

    // Debounce hover detection
    hoverTimeoutRef.current = setTimeout(() => {
      const term = terminalRef.current
      if (!term || !term.element) return

      // Get mouse position relative to terminal
      const rect = term.element.getBoundingClientRect()
      const x = e.clientX - rect.left
      const y = e.clientY - rect.top

      // Get terminal cell dimensions
      const cellWidth = rect.width / term.cols
      const cellHeight = rect.height / term.rows

      // Calculate row/col
      const col = Math.floor(x / cellWidth)
      const row = Math.floor(y / cellHeight)

      // Get current viewport offset
      const buffer = term.buffer.active
      const absoluteRow = buffer.viewportY + row

      // Get line at this row
      const line = buffer.getLine(absoluteRow)
      if (!line) {
        setHoveredImage(null)
        return
      }

      // Extract text from line
      let lineText = ''
      for (let i = 0; i < line.length; i++) {
        lineText += line.getCell(i)?.getChars() || ' '
      }

      // Find image path pattern at cursor position
      // Pattern: /tmp/multiClaude-screenshots/screenshot-*.png (with or without quotes)
      const imagePathRegex = /"?(\/tmp\/multiClaude-screenshots\/screenshot-\d+\.png)"?/g
      let match
      let foundPath: string | null = null

      while ((match = imagePathRegex.exec(lineText)) !== null) {
        const start = match.index
        const end = start + match[0].length
        if (col >= start && col <= end) {
          foundPath = match[1] // Get the captured group without quotes
          break
        }
      }

      if (foundPath) {
        setHoveredImage(foundPath)
        setPopupPosition({ x: e.clientX, y: e.clientY })
      } else {
        setHoveredImage(null)
        setPopupPosition(null)
      }
    }, 150)
  }, [terminalRef])

  // Handle image deletion
  const handleDeleteImage = useCallback(async (filePath: string) => {
    const success = await window.electron.image.delete(filePath)
    if (success) {
      removeImage(terminalId, filePath)
    }
    setHoveredImage(null)
    setPopupPosition(null)
  }, [terminalId, removeImage])

  // Close popup
  const handleClosePopup = useCallback(() => {
    setHoveredImage(null)
    setPopupPosition(null)
  }, [])

  // Handle click on terminal - force show cursor in case it was hidden by CLI
  const handleTerminalClick = () => {
    if (isActive) {
      focus()
      showCursor()
    }
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
    >
      <div
        ref={containerRef}
        className="terminal-container"
        style={{ height: '100%', width: '100%' }}
      />

      {/* Floating scroll-to-bottom button with fade animation */}
      {/* Only show when terminal is active, not at bottom, and no modal is open */}
      <button
        type="button"
        onClick={scrollToBottom}
        className={`absolute bottom-3 right-3 z-50 rounded-full bg-[var(--mc-bg-tertiary)] hover:bg-[var(--mc-bg-hover)] border border-[var(--mc-border)] text-[var(--mc-text-muted)] hover:text-[var(--mc-text-primary)] shadow-lg transition-all duration-200 ${
          isAtBottom || !isActive || settingsModalOpen ? 'opacity-0 pointer-events-none' : 'opacity-100'
        }`}
        style={scrollButtonStyle}
        title="Scroll to bottom"
        aria-label="Scroll to bottom"
        aria-hidden={isAtBottom || !isActive || settingsModalOpen}
      >
        <svg style={scrollButtonIconStyle} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
        </svg>
      </button>

      {/* Image preview popup */}
      <ImagePreviewPopup
        imagePath={hoveredImage}
        position={popupPosition}
        onClose={handleClosePopup}
        onDelete={handleDeleteImage}
      />
    </div>
  )
})
