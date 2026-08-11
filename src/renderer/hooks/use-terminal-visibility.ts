/**
 * useTerminalVisibility — manages the hide/show lifecycle of a terminal panel.
 *
 * Responsibilities:
 *   - Save scroll position synchronously when terminal becomes hidden
 *     (must happen before display:none takes effect — uses useLayoutEffect)
 *   - Refit and repaint each terminal once when its project becomes visible
 *   - Restore scroll position for every pane and focus only the active pane
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
  /** webglLoadingRef from useTerminalWebGL — polled before repainting */
  webglLoadingRef: RefObject<boolean>
  scrollMachineRef: RefObject<TerminalScrollMachine>
  reconcileWebGL: () => void
  performFit: (restoreViewport?: boolean) => boolean
  refreshVisibleRows: () => void
}

export function useTerminalVisibility(params: UseTerminalVisibilityParams): void {
  const {
    terminalRef,
    disposedRef,
    isActive,
    isHidden,
    prevHiddenRef,
    webglLoadingRef,
    scrollMachineRef,
    reconcileWebGL,
    performFit,
    refreshVisibleRows,
  } = params

  // Stable ref to avoid stale active state inside deferred reconciliation.
  const isActiveRefLocal = useRef(isActive)
  isActiveRefLocal.current = isActive

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

    // Repaint every pane when its project becomes visible. Only the active pane
    // receives focus, but inactive sibling renderers need the same visibility
    // reconciliation or their retained canvases can stay blank or stale.
    if (wasHidden && !isHidden && terminalRef.current) {
      let cancelled = false
      let completed = false
      let retryTimer: ReturnType<typeof setTimeout> | null = null
      let fallbackTimer: ReturnType<typeof setTimeout> | null = null

      const restoreVisibleTerminal = () => {
        if (cancelled || completed || disposedRef.current || !terminalRef.current) return
        completed = true

        const scrollMachine = scrollMachineRef.current
        const hiddenViewportIntent = scrollMachine.hiddenViewportIntent
        const savedViewportY = hiddenViewportIntent?.stickToBottom
          ? null
          : hiddenViewportIntent?.viewportY ?? scrollMachine.savedViewportY

        if (!performFit(false)) refreshVisibleRows()

        const terminal = terminalRef.current
        if (hiddenViewportIntent?.stickToBottom) {
          withInstantTerminalScroll(terminal, () => terminal.scrollToBottom())
        } else if (savedViewportY !== null && savedViewportY >= 0) {
          withInstantTerminalScroll(terminal, () => terminal.scrollToLine(savedViewportY))
        }

        if (isActiveRefLocal.current) terminal.focus()

        if (retryTimer) clearTimeout(retryTimer)
        if (fallbackTimer) clearTimeout(fallbackTimer)
      }

      const restoreWithWebGLCheck = () => {
        if (cancelled || completed || disposedRef.current || !terminalRef.current) return

        if (webglLoadingRef.current) {
          retryTimer = setTimeout(restoreWithWebGLCheck, 30)
          return
        }

        restoreVisibleTerminal()
      }

      // Reconcile after the visibility style has reached layout. The fallback
      // guarantees one repaint if WebGL never reports ready, without repeatedly
      // clearing or repainting an already-visible terminal.
      reconcileWebGL()
      fallbackTimer = setTimeout(restoreVisibleTerminal, 1500)
      const frame = requestAnimationFrame(restoreWithWebGLCheck)

      return () => {
        cancelled = true
        cancelAnimationFrame(frame)
        if (retryTimer) clearTimeout(retryTimer)
        if (fallbackTimer) clearTimeout(fallbackTimer)
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isHidden])
}
