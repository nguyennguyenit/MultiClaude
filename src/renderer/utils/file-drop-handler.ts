/**
 * Document-level file drop handler
 *
 * On Linux with Electron, native file drops from file managers often don't
 * trigger DOM drag events consistently. This is a known Electron/Chromium issue.
 *
 * Strategy:
 * 1. Per-terminal DOM events handle normal drag/drop and set a pending drop target
 * 2. Document fallback handles platforms where only top-level events fire
 * 3. IPC fallback handles Electron navigation interception and reuses the pending target
 */

import { useAppStore } from '../stores'
import { insertFilePathsIntoTerminal } from './insert-file-paths'

const TERMINAL_DROP_TARGET_SELECTOR = '[data-terminal-id]'

let initialized = false
let domEventsWorking = false
let pendingDropTerminalId: string | null = null

function getTerminalIdFromTarget(target: EventTarget | null | undefined): string | null {
  if (!target || typeof target !== 'object' || !('closest' in target)) {
    return null
  }

  const terminalElement = (target as {
    closest: (selector: string) => { dataset?: Record<string, string | undefined> } | null
  }).closest(TERMINAL_DROP_TARGET_SELECTOR)

  return terminalElement?.dataset?.terminalId ?? null
}

function getTerminalIdFromPoint(clientX: number, clientY: number): string | null {
  if (typeof document.elementFromPoint !== 'function') return null
  return getTerminalIdFromTarget(document.elementFromPoint(clientX, clientY))
}

function resolveDropTerminalId(target?: EventTarget | null): string | null {
  return resolvePreferredDropTerminalId(
    useAppStore.getState().activeTerminalId,
    getTerminalIdFromTarget(target) ?? pendingDropTerminalId
  )
}

function writePathsToResolvedTerminal(paths: string[], target?: EventTarget | null): void {
  const terminalId = resolveDropTerminalId(target)
  if (!terminalId) {
    console.warn('[FileDropHandler] No terminal available for dropped files')
    return
  }

  writePathsToTerminal(terminalId, paths)
}

function extractFilePaths(files: FileList | null | undefined): string[] {
  if (!files || files.length === 0) return []

  const paths: string[] = []
  for (let i = 0; i < files.length; i++) {
    const file = files[i]
    try {
      const filePath = window.electron.utils.getFilePath(file)
      if (filePath) {
        paths.push(filePath)
      }
    } catch (err) {
      console.error('[FileDropHandler] Error:', err)
    }
  }

  return paths
}

export function setPendingDropTerminal(terminalId: string | null): void {
  pendingDropTerminalId = terminalId
}

export function clearPendingDropTerminal(terminalId?: string): void {
  if (terminalId && pendingDropTerminalId !== terminalId) return
  pendingDropTerminalId = null
}

export function resolvePreferredDropTerminalId(activeTerminalId: string | null, targetTerminalId: string | null): string | null {
  return targetTerminalId ?? activeTerminalId
}

export function writePathsToTerminal(terminalId: string, paths: string[]): void {
  if (paths.length === 0) return
  // Shared entry-point so IPC / document-level drops route through the same
  // media-aware flow as the per-terminal drop hook: image/video paths are
  // queued for flush-on-Enter (and mirrored into the attachment strip)
  // while non-media paths are written straight to the PTY. Writing raw
  // paths directly here previously bypassed Claude-mode prompt hygiene and
  // made Claude Code echo stray [Image N] text below its status bar.
  insertFilePathsIntoTerminal(terminalId, paths)
}

/**
 * Initialize document-level file drop handling
 * Should be called once at app startup
 */
export function initFileDropHandler(): void {
  if (initialized) return
  initialized = true

  // Track if DOM events are working (they fire on dragenter)
  document.addEventListener('dragenter', () => {
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

      const hoveredTerminalId = getTerminalIdFromPoint(e.clientX, e.clientY) ?? getTerminalIdFromTarget(e.target)
      if (hoveredTerminalId) {
        setPendingDropTerminal(hoveredTerminalId)
      }
    }
  })

  // Handle file drops via DOM events (when they work)
  document.addEventListener('drop', (e) => {
    if (!domEventsWorking) return

    e.preventDefault()

    const paths = extractFilePaths(e.dataTransfer?.files)
    if (paths.length > 0) {
      writePathsToResolvedTerminal(paths, e.target)
    }

    clearPendingDropTerminal()
  })

  document.addEventListener('dragend', () => {
    clearPendingDropTerminal()
  })

  document.addEventListener('dragleave', (e) => {
    if (e.relatedTarget === null) {
      clearPendingDropTerminal()
    }
  })

  window.addEventListener('blur', () => {
    clearPendingDropTerminal()
  })

  // IPC fallback - always register
  // Main process intercepts will-navigate for file:// URLs
  window.electron.onFileDrop((filePath) => {
    writePathsToResolvedTerminal([filePath])
    clearPendingDropTerminal()
  })
}
