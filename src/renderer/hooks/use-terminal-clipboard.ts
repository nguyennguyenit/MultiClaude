/**
 * useTerminalClipboard — manages image paste and context menu.
 *
 * Responsibilities:
 *   - Handle Ctrl+V / Cmd+V: detect images in clipboard and save to temp file;
 *     fall back to plain text paste via PTY write
 *   - Register right-click context menu handler via electron IPC (Copy when selection
 *     exists, always Paste)
 *   - Expose attachClipboardListeners(terminal) — called by initTerminal after terminal.open()
 *   - Expose getCtrlVHandler(terminal) — used in attachCustomKeyEventHandler
 *
 * Sub-hooks must NOT import from each other; all orchestration lives in use-terminal.ts.
 */
import { useRef, useCallback } from 'react'
import type { RefObject } from 'react'
import type { Terminal as XTerm } from '@xterm/xterm'
import { useImageStore } from '../stores'

interface UseTerminalClipboardParams {
  terminalId: string
}

interface UseTerminalClipboardResult {
  /**
   * Call after terminal.open() to wire up clipboard-related event listeners
   * (right-click context menu). Copy on selection has been removed — users copy
   * via right-click menu or Cmd/Ctrl+C.
   */
  attachClipboardListeners: (terminal: XTerm) => void
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

export function useTerminalClipboard({ terminalId }: UseTerminalClipboardParams): UseTerminalClipboardResult {

  /**
   * Ref that orchestrator fills with followLiveOutput() after useTerminalScroll is set up.
   */
  const followLiveOutputRef = useRef<(() => void) | null>(null)

  const attachClipboardListeners = useCallback((terminal: XTerm) => {
    // ── Right-click context menu ─────────────────────────────────────────────
    terminal.element?.addEventListener('contextmenu', (e) => {
      if (!(e instanceof MouseEvent)) return
      e.preventDefault()
      const selection = terminal.getSelection() || undefined
      void window.electron.terminal.showContextMenu({ terminalId, x: e.clientX, y: e.clientY, selection })
    })

  }, [terminalId])

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
