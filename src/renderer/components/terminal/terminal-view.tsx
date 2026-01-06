import { useEffect, useRef, memo } from 'react'
import { useTerminal } from '../../hooks/use-terminal'
import { useAppStore, useSettingsStore } from '../../stores'

interface TerminalViewProps {
  terminalId: string
  isActive: boolean
  initialOutput?: string
  /** Callback to expose fit function to parent for resize handling */
  onFitReady?: (fit: () => void) => void
}

export const TerminalView = memo(function TerminalView({ terminalId, isActive, initialOutput, onFitReady }: TerminalViewProps) {
  const { containerRef, initTerminal, write, fit, focus, scrollToBottom, isAtBottom } = useTerminal({
    terminalId,
    initialOutput,
    isActive
  })
  const appendOutput = useAppStore((state) => state.appendOutput)
  const settingsModalOpen = useSettingsStore((state) => state.settingsModalOpen)
  // Skip appending output right after restore to prevent duplicates from shell prompt redraws
  const skipAppendRef = useRef(!!initialOutput)

  // Initialize terminal on mount
  useEffect(() => {
    initTerminal()
  }, [initTerminal])

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
        // Skip appending during restore period to prevent duplicate prompts
        if (!skipAppendRef.current) {
          appendOutput(terminalId, data)
        }
      }
    })
    return unsubscribe
  }, [terminalId, write, appendOutput])

  // Focus when becomes active
  useEffect(() => {
    if (isActive) {
      focus()
      fit()
    }
  }, [isActive, focus, fit])

  // Expose fit function to parent for resize handling
  useEffect(() => {
    onFitReady?.(fit)
  }, [fit, onFitReady])

  return (
    <div
      className="terminal-container-wrapper"
      style={{ height: '100%', width: '100%', position: 'relative' }}
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
        className={`absolute bottom-3 right-3 z-50 p-2 rounded-full bg-[var(--mc-bg-tertiary)] hover:bg-[var(--mc-bg-hover)] border border-[var(--mc-border)] text-[var(--mc-text-muted)] hover:text-[var(--mc-text-primary)] shadow-lg transition-all duration-200 ${
          isAtBottom || !isActive || settingsModalOpen ? 'opacity-0 pointer-events-none' : 'opacity-100'
        }`}
        title="Scroll to bottom"
        aria-label="Scroll to bottom"
        aria-hidden={isAtBottom || !isActive || settingsModalOpen}
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
        </svg>
      </button>
    </div>
  )
})
