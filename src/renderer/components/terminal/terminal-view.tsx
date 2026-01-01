import { useEffect, useRef, useState, memo } from 'react'
import { useTerminal } from '../../hooks/use-terminal'
import { useAppStore } from '../../stores'

interface TerminalViewProps {
  terminalId: string
  isActive: boolean
  initialOutput?: string
  /** Callback to expose fit function to parent for resize handling */
  onFitReady?: (fit: () => void) => void
}

/**
 * Format file path - quote if contains spaces or special chars
 */
function formatPath(path: string): string {
  if (/[\s"'`$\\!&|;<>(){}[\]*?#~]/.test(path)) {
    return `"${path.replace(/"/g, '\\"')}"`
  }
  return path
}

export const TerminalView = memo(function TerminalView({ terminalId, isActive, initialOutput, onFitReady }: TerminalViewProps) {
  const { containerRef, initTerminal, write, fit, focus } = useTerminal({
    terminalId,
    initialOutput
  })
  const appendOutput = useAppStore((state) => state.appendOutput)
  const wrapperRef = useRef<HTMLDivElement>(null)
  const [isDragOver, setIsDragOver] = useState(false)
  const dragCounterRef = useRef(0)
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

  // Listen for file drops via IPC (main process intercepts will-navigate for file:// URLs)
  // This is a fallback for when DOM drag events don't fire (Linux file manager issue)
  useEffect(() => {
    const unsubscribe = window.electron.onFileDrop((filePath) => {
      if (!isActive) return
      const formatted = formatPath(filePath)
      window.electron.terminal.write(terminalId, formatted)
    })
    return unsubscribe
  }, [terminalId, isActive])

  // Drag-drop handlers for file path insertion
  // Use capture phase to intercept events before they reach xterm's internal elements
  useEffect(() => {
    const wrapper = wrapperRef.current
    if (!wrapper) return

    const currentTerminalId = terminalId

    const handleDragEnter = (e: DragEvent) => {
      e.preventDefault()
      e.stopPropagation()
      dragCounterRef.current++
      if (dragCounterRef.current === 1) {
        setIsDragOver(true)
      }
    }

    const handleDragOver = (e: DragEvent) => {
      e.preventDefault()
      e.stopPropagation()
      if (e.dataTransfer) {
        e.dataTransfer.dropEffect = 'copy'
      }
    }

    const handleDragLeave = (e: DragEvent) => {
      e.stopPropagation()
      dragCounterRef.current--
      if (dragCounterRef.current <= 0) {
        dragCounterRef.current = 0
        setIsDragOver(false)
      }
    }

    const handleDrop = (e: DragEvent) => {
      e.preventDefault()
      e.stopPropagation()
      setIsDragOver(false)
      dragCounterRef.current = 0

      const files = e.dataTransfer?.files
      if (!files || files.length === 0) return

      // Extract paths and write to terminal
      const paths: string[] = []
      for (let i = 0; i < files.length; i++) {
        const file = files[i]
        try {
          const filePath = window.electron.utils.getFilePath(file)
          if (filePath) {
            paths.push(formatPath(filePath))
          }
        } catch (err) {
          console.error('[DragDrop] Error:', err)
        }
      }

      if (paths.length > 0) {
        window.electron.terminal.write(currentTerminalId, paths.join(' '))
      }
    }

    // Use capture phase to intercept events during capture (before reaching target)
    wrapper.addEventListener('dragenter', handleDragEnter, { capture: true })
    wrapper.addEventListener('dragover', handleDragOver, { capture: true })
    wrapper.addEventListener('dragleave', handleDragLeave, { capture: true })
    wrapper.addEventListener('drop', handleDrop, { capture: true })

    return () => {
      wrapper.removeEventListener('dragenter', handleDragEnter, { capture: true })
      wrapper.removeEventListener('dragover', handleDragOver, { capture: true })
      wrapper.removeEventListener('dragleave', handleDragLeave, { capture: true })
      wrapper.removeEventListener('drop', handleDrop, { capture: true })
    }
  }, [terminalId])

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
      ref={wrapperRef}
      className="terminal-container-wrapper"
      style={{ height: '100%', width: '100%', position: 'relative' }}
    >
      <div
        ref={containerRef}
        className="terminal-container"
        style={{ height: '100%', width: '100%' }}
      />
      {/* Drop overlay - visual indicator during drag */}
      {isDragOver && (
        <div
          className="terminal-drop-overlay"
          style={{
            position: 'absolute',
            inset: 0,
            zIndex: 10,
            pointerEvents: 'none'
          }}
        />
      )}
    </div>
  )
})
