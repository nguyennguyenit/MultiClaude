import { useEffect, useRef, memo } from 'react'
import { useTerminal } from '../../hooks/use-terminal'
import { useAppStore } from '../../stores'

interface TerminalViewProps {
  terminalId: string
  isActive: boolean
  initialOutput?: string
  /** Callback to expose fit function to parent for resize handling */
  onFitReady?: (fit: () => void) => void
}

export const TerminalView = memo(function TerminalView({ terminalId, isActive, initialOutput, onFitReady }: TerminalViewProps) {
  const { containerRef, initTerminal, write, fit, focus } = useTerminal({
    terminalId,
    initialOutput
  })
  const appendOutput = useAppStore((state) => state.appendOutput)
  // Skip appending output right after restore to prevent duplicates from shell prompt redraws
  const skipAppendRef = useRef(!!initialOutput)

  // Initialize terminal on mount
  useEffect(() => {
    initTerminal()
  }, [initTerminal])

  // After terminal init settles, allow appending output (for restore case)
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
    </div>
  )
})
