import { useState, useCallback, DragEvent } from 'react'

interface UseFileDropOptions {
  onDrop: (paths: string[]) => void
  onDragStateChange?: (isDragOver: boolean) => void
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

function isFileDrag(e: DragEvent): boolean {
  return Array.from(e.dataTransfer?.types ?? []).includes('Files')
}

/**
 * Hook for handling file drag-drop into a component
 * Uses dragCounter to prevent false isDragOver toggle on child elements
 */
export function useFileDrop(options: UseFileDropOptions): UseFileDropReturn {
  const {
    onDrop,
    onDragStateChange
  } = options

  const [isDragOver, setIsDragOver] = useState(false)
  const [, setDragCounter] = useState(0)

  const handleDragEnter = useCallback((e: DragEvent) => {
    if (!isFileDrag(e)) return

    e.preventDefault()
    e.stopPropagation()
    setDragCounter(prev => {
      if (prev === 0) {
        setIsDragOver(true)
        onDragStateChange?.(true)
      }
      return prev + 1
    })
  }, [onDragStateChange])

  const handleDragOver = useCallback((e: DragEvent) => {
    if (!isFileDrag(e)) return

    e.preventDefault()
    e.stopPropagation()

    if (e.dataTransfer) {
      e.dataTransfer.dropEffect = 'copy'
    }
  }, [])

  const handleDragLeave = useCallback((e: DragEvent) => {
    if (!isFileDrag(e)) return

    e.preventDefault()
    e.stopPropagation()
    setDragCounter(prev => {
      const next = prev - 1
      if (next <= 0) {
        setIsDragOver(false)
        onDragStateChange?.(false)
        return 0
      }
      return next
    })
  }, [onDragStateChange])

  const handleDrop = useCallback((e: DragEvent) => {
    if (!isFileDrag(e)) return

    e.preventDefault()
    e.stopPropagation()
    setIsDragOver(false)
    setDragCounter(0)
    onDragStateChange?.(false)

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
        paths.push(filePath)
      } else {
        console.warn(`FileDrop: Could not get path for file: ${file.name}. It might be a security restriction or an unsupported file type.`)
      }
    }

    if (paths.length > 0) {
      onDrop(paths)
    }
  }, [onDrop, onDragStateChange])

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
