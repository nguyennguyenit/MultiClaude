/**
 * useTerminalClipboard — manages selection auto-copy, image paste, and context menu.
 *
 * Responsibilities:
 *   - Auto-copy text selections to clipboard (with debounce and toast debounce)
 *   - Handle Ctrl+V / Cmd+V: detect images in clipboard and save to temp file;
 *     fall back to plain text paste via PTY write
 *   - Register right-click context menu handler via electron IPC
 *   - Expose attachClipboardListeners(terminal) — called by initTerminal after terminal.open()
 *   - Expose getCtrlVHandler(terminal) — used in attachCustomKeyEventHandler
 *
 * Sub-hooks must NOT import from each other; all orchestration lives in use-terminal.ts.
 */
import { useRef, useCallback } from 'react'
import type { RefObject } from 'react'
import type { Terminal as XTerm, IDisposable } from '@xterm/xterm'
import { useToastStore, useImageStore } from '../stores'

const COPY_TOAST_DEBOUNCE = 2000  // ms between copy notifications

export interface ClipboardViewportEventListener {
  target: EventTarget
  type: string
  handler: EventListener
}

interface UseTerminalClipboardParams {
  terminalRef: RefObject<XTerm | null>
  disposedRef: RefObject<boolean>
  terminalId: string
}

interface UseTerminalClipboardResult {
  /**
   * Call after terminal.open() to wire up all clipboard-related event listeners.
   * Returns cleanup handles the orchestrator must dispose on unmount.
   */
  attachClipboardListeners: (terminal: XTerm) => {
    selectionChangeDisposable: IDisposable
    selectionListeners: ClipboardViewportEventListener[]
  }
  /**
   * Build the Ctrl+V key handler.
   * Pass the result to terminal.attachCustomKeyEventHandler in initTerminal.
   */
  getCtrlVHandler: () => (e: KeyboardEvent) => boolean | undefined
  /**
   * Ref that orchestrator fills with followLiveOutput() after useTerminalScroll is set up.
   * Clipboard paste operations call this to re-anchor scroll to live output.
   */
  followLiveOutputRef: RefObject<(() => void) | null>
}

export function useTerminalClipboard(params: UseTerminalClipboardParams): UseTerminalClipboardResult {
  const { terminalId } = params

  const lastCopyToastTimeRef = useRef(0)
  const selectionCopyPendingRef = useRef(false)
  const selectionChangedSinceMouseDownRef = useRef(false)
  const selectionCopyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastSelectionSnapshotRef = useRef('')
  const terminalRefForHandlers = useRef<XTerm | null>(null)

  /**
   * Ref that orchestrator fills with followLiveOutput() after useTerminalScroll is set up.
   */
  const followLiveOutputRef = useRef<(() => void) | null>(null)

  const copySelectionToClipboard = useCallback(async (selectionOverride?: string) => {
    const selection = selectionOverride ?? terminalRefForHandlers.current?.getSelection()
    if (!selection) return

    try {
      await navigator.clipboard.writeText(selection)
      const now = Date.now()
      if (now - lastCopyToastTimeRef.current > COPY_TOAST_DEBOUNCE) {
        useToastStore.getState().addToast('Copied to clipboard', 'info')
        lastCopyToastTimeRef.current = now
      }
    } catch {
      // Clipboard permission denied — ignore silently
    }
  }, [])

  const attachClipboardListeners = useCallback((terminal: XTerm) => {
    // Store terminal ref for handlers that need it after open()
    terminalRefForHandlers.current = terminal

    // ── Selection auto-copy helpers ──────────────────────────────────────────
    const clearSelectionCopyTimer = () => {
      if (selectionCopyTimerRef.current) {
        clearTimeout(selectionCopyTimerRef.current)
        selectionCopyTimerRef.current = null
      }
    }

    const scheduleSelectionCopy = () => {
      clearSelectionCopyTimer()
      selectionCopyTimerRef.current = setTimeout(() => {
        selectionCopyTimerRef.current = null
        const selection = lastSelectionSnapshotRef.current || terminal.getSelection()
        void copySelectionToClipboard(selection)
      }, 80)
    }

    const finalizeSelectionCopy = async () => {
      if (!selectionCopyPendingRef.current) return

      const didSelectionChange = selectionChangedSinceMouseDownRef.current
      selectionCopyPendingRef.current = false
      selectionChangedSinceMouseDownRef.current = false
      clearSelectionCopyTimer()

      if (!didSelectionChange) return
      const selection = terminal.getSelection() || lastSelectionSnapshotRef.current
      lastSelectionSnapshotRef.current = ''
      await copySelectionToClipboard(selection)
    }

    // ── xterm selection-change disposable ────────────────────────────────────
    const selectionChangeDisposable = terminal.onSelectionChange(() => {
      if (selectionCopyPendingRef.current) {
        selectionChangedSinceMouseDownRef.current = true
        const selection = terminal.getSelection()
        if (selection) lastSelectionSnapshotRef.current = selection
        scheduleSelectionCopy()
      }
    })

    // ── DOM mouse listeners on terminal element ──────────────────────────────
    const selectionListeners: ClipboardViewportEventListener[] = []
    const addSelectionListener = (target: EventTarget, type: string, handler: EventListener) => {
      target.addEventListener(type, handler)
      selectionListeners.push({ target, type, handler })
    }

    if (terminal.element) {
      addSelectionListener(terminal.element, 'mousedown', (event) => {
        if (!(event instanceof MouseEvent) || event.button !== 0) return
        selectionCopyPendingRef.current = true
        selectionChangedSinceMouseDownRef.current = false
        lastSelectionSnapshotRef.current = ''
      })
      addSelectionListener(window, 'mouseup', () => { void finalizeSelectionCopy() })
      addSelectionListener(window, 'blur', () => { void finalizeSelectionCopy() })
    }

    // ── Right-click context menu ─────────────────────────────────────────────
    terminal.element?.addEventListener('contextmenu', (e) => {
      if (!(e instanceof MouseEvent)) return
      e.preventDefault()
      void window.electron.terminal.showContextMenu({ terminalId, x: e.clientX, y: e.clientY })
    })

    return { selectionChangeDisposable, selectionListeners }
  }, [copySelectionToClipboard, terminalId])

  /**
   * Returns the Ctrl+V / Cmd+V key handler for use in attachCustomKeyEventHandler.
   * Called from initTerminal after clipboard listeners are attached.
   */
  const getCtrlVHandler = useCallback(() => {
    return (e: KeyboardEvent): boolean | undefined => {
      if (!((e.ctrlKey || e.metaKey) && e.key === 'v')) return undefined

      e.preventDefault()

      navigator.clipboard.read().then(async (clipboardItems) => {
        let hasImage = false

        for (const item of clipboardItems) {
          const imageType = item.types.find(t => t.startsWith('image/'))
          if (imageType) {
            hasImage = true
            try {
              const blob = await item.getType(imageType)
              const reader = new FileReader()
              const base64Promise = new Promise<string>((resolve, reject) => {
                reader.onload = () => { resolve((reader.result as string).split(',')[1]) }
                reader.onerror = reject
              })
              reader.readAsDataURL(blob)
              const base64Data = await base64Promise

              const filePath = await window.electron.clipboard.saveImage(base64Data)
              if (filePath) {
                followLiveOutputRef.current?.()
                useImageStore.getState().addImage(terminalId, filePath)
                const formatted = /[\s"'`$\\!&|;<>(){}[\]*?#~]/.test(filePath)
                  ? `"${filePath.replace(/"/g, '\\"')}"`
                  : filePath
                window.electron.terminal.write(terminalId, formatted)
              }
            } catch (err) {
              console.error('Failed to process clipboard image:', err)
            }
            break
          }
        }

        if (!hasImage) {
          try {
            const text = await navigator.clipboard.readText()
            if (text) {
              followLiveOutputRef.current?.()
              window.electron.terminal.write(terminalId, text)
            }
          } catch {
            // Clipboard permission denied
          }
        }
      }).catch(() => {
        navigator.clipboard.readText().then(text => {
          if (text) {
            followLiveOutputRef.current?.()
            window.electron.terminal.write(terminalId, text)
          }
        }).catch(() => { })
      })

      return false
    }
  }, [terminalId])

  return { attachClipboardListeners, getCtrlVHandler, followLiveOutputRef }
}
