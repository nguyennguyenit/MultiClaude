import { useEffect, memo } from 'react'
import { useTerminal } from '../../hooks/use-terminal'

interface TerminalViewProps {
  terminalId: string
  isActive: boolean
}

export const TerminalView = memo(function TerminalView({ terminalId, isActive }: TerminalViewProps) {
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

  return (
    <div
      ref={containerRef}
      className={`terminal-container ${isActive ? 'block' : 'hidden'}`}
      style={{ height: '100%' }}
    />
  )
})
