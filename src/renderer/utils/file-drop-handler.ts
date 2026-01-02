/**
 * Document-level file drop handler
 *
 * On Linux with Electron, native file drops from file managers often don't
 * trigger DOM drag events consistently. This is a known Electron/Chromium issue.
 *
 * Strategy:
 * 1. DOM events - Register handlers but they may not fire
 * 2. IPC fallback - Main process intercepts will-navigate for file:// URLs
 *    This requires NOT preventing default on drag events when DOM events don't fire
 */

import { useAppStore } from '../stores'

/**
 * Format file path - quote if contains spaces or special chars
 */
function formatPath(path: string): string {
  if (/[\s"'`$\\!&|;<>(){}[\]*?#~]/.test(path)) {
    return `"${path.replace(/"/g, '\\"')}"`
  }
  return path
}

/**
 * Write file path to active terminal
 */
function writePathToActiveTerminal(filePath: string): void {
  const { activeTerminalId } = useAppStore.getState()
  if (!activeTerminalId) {
    console.warn('[FileDropHandler] No active terminal')
    return
  }

  const formatted = formatPath(filePath)
  console.log('[FileDropHandler] Writing to terminal:', activeTerminalId, formatted)
  window.electron.terminal.write(activeTerminalId, formatted)
}

let initialized = false
let domEventsWorking = false

/**
 * Initialize document-level file drop handling
 * Should be called once at app startup
 */
export function initFileDropHandler(): void {
  if (initialized) return
  initialized = true

  console.log('[FileDropHandler] Initializing...')

  // Track if DOM events are working (they fire on dragenter)
  document.addEventListener('dragenter', () => {
    console.log('[FileDropHandler] dragenter - DOM events working')
    domEventsWorking = true
  })

  // Only prevent default if DOM events are working
  // If not, let the drop cause navigation which will-navigate can intercept
  document.addEventListener('dragover', (e) => {
    if (domEventsWorking) {
      e.preventDefault()
      if (e.dataTransfer) {
        e.dataTransfer.dropEffect = 'copy'
      }
    }
  })

  // Handle file drops via DOM events (when they work)
  document.addEventListener('drop', (e) => {
    if (!domEventsWorking) return

    e.preventDefault()
    console.log('[FileDropHandler] drop event')

    const files = e.dataTransfer?.files
    if (!files || files.length === 0) return

    const paths: string[] = []
    for (let i = 0; i < files.length; i++) {
      const file = files[i]
      try {
        const filePath = window.electron.utils.getFilePath(file)
        if (filePath) {
          paths.push(formatPath(filePath))
        }
      } catch (err) {
        console.error('[FileDropHandler] Error:', err)
      }
    }

    if (paths.length > 0) {
      const { activeTerminalId } = useAppStore.getState()
      if (activeTerminalId) {
        window.electron.terminal.write(activeTerminalId, paths.join(' '))
      }
    }
  })

  // IPC fallback - always register
  // Main process intercepts will-navigate for file:// URLs
  window.electron.onFileDrop((filePath) => {
    console.log('[FileDropHandler] IPC file drop:', filePath)
    writePathToActiveTerminal(filePath)
  })

  console.log('[FileDropHandler] Initialized - DOM events will be detected on first drag')
}
