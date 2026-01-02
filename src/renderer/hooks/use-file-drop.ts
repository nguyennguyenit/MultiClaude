import { useState, useCallback, DragEvent } from 'react'

interface UseFileDropOptions {
  onDrop: (paths: string[]) => void
  formatPath?: (path: string) => string
  separator?: string
}

interface UseFileDropReturn {
  isDragOver: boolean
  dropHandlers: {
    onDragEnter: (e: DragEvent) => void
    onDragOver: (e: DragEvent) => void
    onDragLeave: (e: DragEvent) => void
    onDrop: (e: DragEvent) => void
  }
}

/**
 * Format file path - quote if contains spaces or special chars
 */
function defaultFormatPath(path: string): string {
  // Quote paths containing spaces or shell-special characters
  if (/[\s"'`$\\!&|;<>(){}[\]*?#~]/.test(path)) {
    // Escape existing double quotes and wrap in quotes
    return `"${path.replace(/"/g, '\\"')}"`
  }
  return path
}

/**
 * Hook for handling file drag-drop into a component
 * Uses dragCounter to prevent false isDragOver toggle on child elements
 */
export function useFileDrop(options: UseFileDropOptions): UseFileDropReturn {
  const {
    onDrop,
    formatPath = defaultFormatPath,
    separator = '\n'
  } = options

  const [isDragOver, setIsDragOver] = useState(false)
  const [dragCounter, setDragCounter] = useState(0)

  const handleDragEnter = useCallback((e: DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragCounter(prev => {
      if (prev === 0) setIsDragOver(true)
      return prev + 1
    })
  }, [])

  const handleDragOver = useCallback((e: DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
  }, [])

  const handleDragLeave = useCallback((e: DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragCounter(prev => {
      const next = prev - 1
      if (next === 0) setIsDragOver(false)
      return next
    })
  }, [])

  const handleDrop = useCallback((e: DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragOver(false)
    setDragCounter(0)

    const files = e.dataTransfer?.files
    if (!files || files.length === 0) {
      console.warn('FileDrop: No files found in dataTransfer.')
      return
    }

    // Extract paths using Electron's webUtils API (works with contextIsolation)
    const paths: string[] = []
    for (let i = 0; i < files.length; i++) {
      const file = files[i]
      const filePath = window.electron.utils.getFilePath(file)
      if (filePath) {
        paths.push(formatPath(filePath))
      } else {
        console.warn(`FileDrop: Could not get path for file: ${file.name}. It might be a security restriction or an unsupported file type.`)
      }
    }

    if (paths.length > 0) {
      const text = paths.join(separator)
      onDrop([text]) // Pass as single joined string
    }
  }, [onDrop, formatPath, separator])

  return {
    isDragOver,
    dropHandlers: {
      onDragEnter: handleDragEnter,
      onDragOver: handleDragOver,
      onDragLeave: handleDragLeave,
      onDrop: handleDrop
    }
  }
}
