import { useEffect, useRef, useCallback, memo } from 'react'
import { TerminalView } from './terminal-view'

interface TerminalPaneProps {
  terminalId: string
  isActive: boolean
  onActivate: () => void
}

/** Wrapper for TerminalView with click-to-focus, resize handling, and focus indicator */
export const TerminalPane = memo(function TerminalPane({
  terminalId,
  isActive,
  onActivate
}: TerminalPaneProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const resizeTimeoutRef = useRef<number | undefined>(undefined)
  const terminalFitRef = useRef<(() => void) | null>(null)

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
      className={`terminal-pane h-full w-full ${isActive ? 'terminal-pane-active' : ''}`}
    >
      <TerminalView
        terminalId={terminalId}
        isActive={isActive}
        onFitReady={handleTerminalFit}
      />
    </div>
  )
})
