import { useEffect, memo } from 'react'
import { useTerminal } from '../../hooks/use-terminal'

interface TerminalViewProps {
  terminalId: string
  isActive: boolean
  /** Callback to expose fit function to parent for resize handling */
  onFitReady?: (fit: () => void) => void
}

export const TerminalView = memo(function TerminalView({ terminalId, isActive, onFitReady }: TerminalViewProps) {
  const { containerRef, initTerminal, write, fit, focus } = useTerminal({
    terminalId
  })

  // Initialize terminal on mount
  useEffect(() => {
    initTerminal()
  }, [initTerminal])

  // Listen for terminal output
  useEffect(() => {
    const unsubscribe = window.electron.terminal.onOutput(({ terminalId: id, data }) => {
      if (id === terminalId) {
        write(data)
      }
    })
    return unsubscribe
  }, [terminalId, write])

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
      ref={containerRef}
      className="terminal-container"
      style={{ height: '100%', width: '100%' }}
    />
  )
})
