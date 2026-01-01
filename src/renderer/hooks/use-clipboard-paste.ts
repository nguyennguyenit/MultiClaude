import { useCallback, useEffect, useRef } from 'react'

interface UseClipboardPasteOptions {
  /** Terminal ID to write to */
  terminalId: string
  /** Container element ref to attach listener */
  containerRef: React.RefObject<HTMLElement | null>
  /** Whether this terminal is active */
  isActive: boolean
}

/**
 * Format file path - quote if contains spaces or special chars
 * Shared logic with use-file-drop.ts
 */
function formatFilePath(path: string): string {
  if (/[\s"'`$\\!&|;<>(){}[\]*?#~]/.test(path)) {
    return `"${path.replace(/"/g, '\\"')}"`
  }
  return path
}

/**
 * Hook for handling clipboard paste with image detection
 * - If clipboard has image: save to temp, insert path
 * - If clipboard has text: let xterm handle normally
 */
export function useClipboardPaste({
  terminalId,
  containerRef,
  isActive
}: UseClipboardPasteOptions) {
  const isProcessingRef = useRef(false)

  const handlePaste = useCallback(async (e: ClipboardEvent) => {
    // Only handle paste when terminal is active
    if (!isActive) return

    // Prevent double processing
    if (isProcessingRef.current) return

    // Check if clipboard has image
    const items = e.clipboardData?.items
    if (!items) return

    // Look for image in clipboard items
    let hasImage = false
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.startsWith('image/')) {
        hasImage = true
        break
      }
    }

    // If no image, let xterm handle text paste normally
    if (!hasImage) return

    // Prevent default text paste
    e.preventDefault()
    e.stopPropagation()

    isProcessingRef.current = true

    try {
      // Call main process to save clipboard image
      const filePath = await window.electron.clipboard.saveImage()

      if (filePath) {
        // Format path and write to terminal
        const formattedPath = formatFilePath(filePath)
        window.electron.terminal.write(terminalId, formattedPath)
      }
    } catch (error) {
      console.error('Failed to save clipboard image:', error)
    } finally {
      isProcessingRef.current = false
    }
  }, [terminalId, isActive])

  // Attach paste listener to container
  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    container.addEventListener('paste', handlePaste)
    return () => container.removeEventListener('paste', handlePaste)
  }, [containerRef, handlePaste])
}
