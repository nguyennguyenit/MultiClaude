import { useEffect, memo } from 'react'
import { useTerminal } from '../../hooks/use-terminal'
import { useFileDrop } from '../../hooks/use-file-drop'
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

  // File drop handler - write dropped file paths to PTY
  const { isDragOver, dropHandlers } = useFileDrop({
    onDrop: (paths) => {
      window.electron.terminal.write(terminalId, paths[0])
    }
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
        appendOutput(terminalId, data)
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
      ref={containerRef}
      className={`terminal-container${isDragOver ? ' terminal-drop-active' : ''}`}
      style={{ height: '100%', width: '100%' }}
      {...dropHandlers}
    />
  )
})
