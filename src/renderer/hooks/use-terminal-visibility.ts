/**
 * useTerminalVisibility — manages the hide/show lifecycle of a terminal panel.
 *
 * Responsibilities:
 *   - Save scroll position synchronously when terminal becomes hidden
 *     (must happen before display:none takes effect — uses useLayoutEffect)
 *   - Restore scroll position and focus when terminal becomes visible again,
 *     using a 5-stage timeout cascade with explicit cancellation support
 *   - Call reconcileVisibleTerminal (fit + repaint) on re-show
 *
 * The 5-stage cascade uses 80 / 200 / 500 / 1000 / 1500 ms delays.
 * These values are intentional and must NOT be changed.
 *
 * Sub-hooks must NOT import from each other; all orchestration lives in use-terminal.ts.
 */
import { useLayoutEffect, useRef } from 'react'
import type { RefObject } from 'react'
import type { Terminal as XTerm } from '@xterm/xterm'
import type { TerminalScrollMachine } from '../utils/terminal-scroll-machine'
import {
  createUserScrollIntent,
  TERMINAL_SCROLL_THRESHOLD,
  withInstantTerminalScroll,
} from '../utils/terminal-scroll-utils'

interface UseTerminalVisibilityParams {
  terminalRef: RefObject<XTerm | null>
  disposedRef: RefObject<boolean>
  isActive: boolean
  isHidden: boolean
  prevHiddenRef: RefObject<boolean>
  isActiveRef: RefObject<boolean>
  /** webglLoadingRef from useTerminalWebGL — polled before restoring scroll */
  webglLoadingRef: RefObject<boolean>
  scrollMachineRef: RefObject<TerminalScrollMachine>
  performFit: (restoreViewport?: boolean) => boolean
  reconcileWebGL: () => void
  clearTextureAtlas: () => void
}

export function useTerminalVisibility(params: UseTerminalVisibilityParams): void {
  const {
    terminalRef,
    disposedRef,
    isActive,
    isHidden,
    prevHiddenRef,
    isActiveRef,
    webglLoadingRef,
    scrollMachineRef,
    performFit,
    clearTextureAtlas,
  } = params

  // Stable ref to avoid stale-closure issues inside the cascade
  const isActiveRefLocal = useRef(isActive)
  isActiveRefLocal.current = isActive

  const reconcileVisibleTerminal = (savedViewportY: number | null, stickToBottom = false) => {
    if (!terminalRef.current || disposedRef.current) return

    clearTextureAtlas()
    performFit(false)

    if (stickToBottom && terminalRef.current) {
      const terminal = terminalRef.current
      withInstantTerminalScroll(terminal, () => terminal.scrollToBottom())
    } else if (savedViewportY !== null && savedViewportY >= 0 && terminalRef.current) {
      const terminal = terminalRef.current
      withInstantTerminalScroll(terminal, () => terminal.scrollToLine(savedViewportY))
    }
  }

  useLayoutEffect(() => {
    const wasHidden = prevHiddenRef.current
    prevHiddenRef.current = isHidden

    // SAVE scroll position when becoming hidden (synchronously, before display:none)
    if (!wasHidden && isHidden && terminalRef.current) {
      const buffer = terminalRef.current.buffer.active
      const scrollMachine = scrollMachineRef.current
      scrollMachine.savedViewportY = buffer.viewportY
      scrollMachine.hiddenViewportIntent = createUserScrollIntent(
        buffer.baseY,
        buffer.viewportY,
        TERMINAL_SCROLL_THRESHOLD
      )
    }

    // RESTORE scroll position and focus when becoming visible
    if (wasHidden && !isHidden && isActive && terminalRef.current) {
      let cancelled = false

      const restoreScrollAndCursor = () => {
        if (cancelled || disposedRef.current || !terminalRef.current) return

        const scrollMachine = scrollMachineRef.current
        const hiddenViewportIntent = scrollMachine.hiddenViewportIntent
        const savedViewportY = hiddenViewportIntent?.stickToBottom
          ? null
          : hiddenViewportIntent?.viewportY ?? scrollMachine.savedViewportY

        reconcileVisibleTerminal(savedViewportY, hiddenViewportIntent?.stickToBottom ?? false)

        terminalRef.current.focus()
      }

      const restoreWithWebGLCheck = () => {
        if (cancelled || disposedRef.current || !terminalRef.current || !isActiveRef.current) return

        // If WebGL is still loading, retry after a short delay
        if (webglLoadingRef.current) {
          setTimeout(restoreWithWebGLCheck, 30)
          return
        }

        restoreScrollAndCursor()
      }

      // 5-stage cascade — values are intentional, do not modify
      const timer1 = setTimeout(restoreWithWebGLCheck, 80)
      const timer2 = setTimeout(restoreWithWebGLCheck, 200)
      const timer3 = setTimeout(restoreWithWebGLCheck, 500)
      const timer4 = setTimeout(restoreWithWebGLCheck, 1000)
      const timer5 = setTimeout(() => {
        if (cancelled || disposedRef.current || !terminalRef.current || !isActiveRef.current) return
        restoreScrollAndCursor()
      }, 1500)

      return () => {
        cancelled = true
        clearTimeout(timer1)
        clearTimeout(timer2)
        clearTimeout(timer3)
        clearTimeout(timer4)
        clearTimeout(timer5)
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isHidden, isActive])
}
