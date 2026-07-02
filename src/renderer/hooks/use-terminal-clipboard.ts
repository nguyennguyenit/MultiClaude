/**
 * useTerminalClipboard — manages image paste and context menu.
 *
 * Responsibilities:
 *   - Handle Ctrl+V / Cmd+V: delegate to shared pasteFromClipboard util
 *   - Open themed React context menu on right-click (Copy when selection exists, Paste)
 *   - Expose attachClipboardListeners(terminal) — called by initTerminal after terminal.open()
 *   - Expose getCtrlVHandler(terminal) — used in attachCustomKeyEventHandler
 */
import { useRef, useCallback } from 'react'
import type { RefObject } from 'react'
import type { Terminal as XTerm } from '@xterm/xterm'
import { useContextMenuStore, type ContextMenuItem } from '../stores/context-menu-store'
import { pasteFromClipboard } from '../utils/paste-from-clipboard'
import { getSplitHandlers } from '../utils/terminal-context-actions'
import type { PaneSplitDirection } from '@shared/types'

const ARROW_TO_SPLIT: Record<string, PaneSplitDirection> = {
  ArrowRight: 'right',
  ArrowLeft: 'left',
  ArrowDown: 'down',
  ArrowUp: 'up'
}

interface UseTerminalClipboardParams {
  terminalId: string
}

interface UseTerminalClipboardResult {
  /**
   * Call after terminal.open() to wire up clipboard-related event listeners
   * (right-click context menu). Copy on selection has been removed — users copy
   * via right-click menu or Cmd/Ctrl+C.
   */
  attachClipboardListeners: (terminal: XTerm, onTextWrite?: (payload: string) => void) => void
  /**
   * Build the Ctrl+V key handler for the given xterm instance. Pass the
   * result to terminal.attachCustomKeyEventHandler in initTerminal. The
   * terminal reference is forwarded to pasteFromClipboard so it can read
   * bracketedPasteMode and wrap the payload accordingly.
   */
  getCtrlVHandler: (terminal: XTerm, onTextWrite?: (payload: string) => void) => (e: KeyboardEvent) => boolean | undefined
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

  const attachClipboardListeners = useCallback((terminal: XTerm, onTextWrite?: (payload: string) => void) => {
    terminal.element?.addEventListener('contextmenu', (e) => {
      if (!(e instanceof MouseEvent)) return
      e.preventDefault()
      const selection = terminal.getSelection() || undefined
      const items: ContextMenuItem[] = []
      if (selection) {
        items.push({
          id: 'copy',
          label: 'Copy',
          onSelect: () => {
            void navigator.clipboard.writeText(selection)
          }
        })
        items.push({ id: 'sep-copy', label: '', separator: true })
      }
      items.push({
        id: 'paste',
        label: 'Paste',
        onSelect: () => {
          void pasteFromClipboard(terminalId, () => followLiveOutputRef.current?.(), terminal, onTextWrite)
        }
      })

      const split = getSplitHandlers()
      if (split.executeSplit) {
        // Right-click splits the clicked terminal, not the focused one — pass
        // terminalId so executeSplit targets this pane regardless of focus.
        const disabled = split.atLimit
        const limitTitle = split.atLimit ? `Terminal limit (${split.limit}) reached` : undefined
        items.push({ id: 'sep-split', label: '', separator: true })
        items.push({ id: 'split-right', label: 'Split right', shortcut: '⌘⇧→', disabled, title: limitTitle, onSelect: () => split.executeSplit?.('right', terminalId) })
        items.push({ id: 'split-left', label: 'Split left', shortcut: '⌘⇧←', disabled, title: limitTitle, onSelect: () => split.executeSplit?.('left', terminalId) })
        items.push({ id: 'split-down', label: 'Split down', shortcut: '⌘⇧↓', disabled, title: limitTitle, onSelect: () => split.executeSplit?.('down', terminalId) })
        items.push({ id: 'split-up', label: 'Split up', shortcut: '⌘⇧↑', disabled, title: limitTitle, onSelect: () => split.executeSplit?.('up', terminalId) })
      }

      useContextMenuStore.getState().openMenu({ x: e.clientX, y: e.clientY, items })
    })
  }, [terminalId])

  const getCtrlVHandler = useCallback((terminal: XTerm, onTextWrite?: (payload: string) => void) => {
    return (e: KeyboardEvent): boolean | undefined => {
      // Intercept split hotkeys before shell scroll-by-line handling.
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && !e.altKey) {
        const dir = ARROW_TO_SPLIT[e.key] ?? ARROW_TO_SPLIT[e.code]
        if (dir) {
          e.preventDefault()
          getSplitHandlers().executeSplit?.(dir)
          return false
        }
      }
      if (!((e.ctrlKey || e.metaKey) && e.key === 'v')) return undefined
      e.preventDefault()
      void pasteFromClipboard(terminalId, () => followLiveOutputRef.current?.(), terminal, onTextWrite)
      return false
    }
  }, [terminalId])

  return { attachClipboardListeners, getCtrlVHandler, followLiveOutputRef }
}
