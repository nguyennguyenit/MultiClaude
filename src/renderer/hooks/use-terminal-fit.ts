/**
 * useTerminalFit — manages terminal resize and fit operations.
 *
 * Responsibilities:
 *   - performFit(): call FitAddon.fit(), refresh visible rows, restore viewport
 *   - cancelScheduledFit(): cancel pending animation-frame and settle-timer fits
 *   - fit(): public entry — schedules performFit with requestAnimationFrame + settle timer
 *   - Sets up ResizeObserver and window resize listener to auto-fit on container changes
 *
 * Sub-hooks must NOT import from each other; all orchestration lives in use-terminal.ts.
 */
import { useCallback, useEffect, useRef } from 'react'
import type { RefObject } from 'react'
import type { Terminal as XTerm } from '@xterm/xterm'
import type { FitAddon } from '@xterm/addon-fit'
import type { TerminalScrollMachine } from '../utils/terminal-scroll-machine'
import { resolveFitViewportRestoreTarget } from '../utils/terminal-scroll-utils'

const RESIZE_REFIT_SETTLE_DELAY = 120  // ms second fit after layout settles

interface UseTerminalFitParams {
  terminalRef: RefObject<XTerm | null>
  fitAddonRef: RefObject<FitAddon | null>
  containerRef: RefObject<HTMLDivElement | null>
  disposedRef: RefObject<boolean>
  scrollMachineRef: RefObject<TerminalScrollMachine>
  refreshVisibleRows: () => void
}

interface UseTerminalFitResult {
  performFit: (restoreViewport?: boolean) => boolean
  cancelScheduledFit: () => void
  fit: () => void
}

export function useTerminalFit(params: UseTerminalFitParams): UseTerminalFitResult {
  const {
    terminalRef,
    fitAddonRef,
    containerRef,
    disposedRef,
    scrollMachineRef,
    refreshVisibleRows,
  } = params

  const fitAnimationFrameRef = useRef<number | null>(null)
  const fitSettleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const performFit = useCallback((restoreViewport = true) => {
    const terminal = terminalRef.current
    const fitAddon = fitAddonRef.current
    const container = containerRef.current
    if (!terminal || !fitAddon || !container || disposedRef.current) return false
    if (container.clientWidth === 0 || container.clientHeight === 0) return false

    const savedViewportY = terminal.buffer.active.viewportY
    const wasAtBottom = scrollMachineRef.current.isAtBottom

    try {
      fitAddon.fit()
    } catch {
      return false
    }

    refreshVisibleRows()

    const restoreTarget = resolveFitViewportRestoreTarget({
      restoreViewport,
      wasAtBottom,
      savedViewportY,
      currentBaseY: terminal.buffer.active.baseY
    })

    if (restoreTarget === 'bottom') terminalRef.current?.scrollToBottom()
    else if (typeof restoreTarget === 'number') terminalRef.current?.scrollToLine(restoreTarget)

    return true
  }, [containerRef, disposedRef, fitAddonRef, refreshVisibleRows, scrollMachineRef, terminalRef])

  const cancelScheduledFit = useCallback(() => {
    if (fitAnimationFrameRef.current !== null) {
      cancelAnimationFrame(fitAnimationFrameRef.current)
      fitAnimationFrameRef.current = null
    }
    if (fitSettleTimerRef.current) {
      clearTimeout(fitSettleTimerRef.current)
      fitSettleTimerRef.current = null
    }
  }, [])

  const fit = useCallback(() => {
    if (disposedRef.current) return
    cancelScheduledFit()
    fitAnimationFrameRef.current = requestAnimationFrame(() => {
      fitAnimationFrameRef.current = null
      if (!performFit()) return
      fitSettleTimerRef.current = setTimeout(() => {
        fitSettleTimerRef.current = null
        performFit()
      }, RESIZE_REFIT_SETTLE_DELAY)
    })
  }, [cancelScheduledFit, disposedRef, performFit])

  // ── ResizeObserver + window resize ─────────────────────────────────────────
  const observedContainerSizeRef = useRef({ width: 0, height: 0 })
  useEffect(() => {
    const container = containerRef.current
    if (!container || typeof ResizeObserver === 'undefined') return
    observedContainerSizeRef.current = { width: Math.round(container.clientWidth), height: Math.round(container.clientHeight) }
    const observer = new ResizeObserver((entries) => {
      const e = entries[0]
      if (!e) return
      const w = Math.round(e.contentRect.width), h = Math.round(e.contentRect.height)
      if (w <= 0 || h <= 0) return
      const p = observedContainerSizeRef.current
      if (p.width === w && p.height === h) return
      observedContainerSizeRef.current = { width: w, height: h }
      fit()
    })
    observer.observe(container)
    return () => observer.disconnect()
  }, [containerRef, fit])

  useEffect(() => {
    const h = () => fit()
    window.addEventListener('resize', h)
    return () => window.removeEventListener('resize', h)
  }, [fit])

  return { performFit, cancelScheduledFit, fit }
}
