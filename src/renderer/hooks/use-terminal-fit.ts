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
import { isPaneDragging, subscribePaneDragging } from '../utils/pane-drag-state'
import { useSettingsStore } from '../stores'

// Part D: debounce before triggering silent snapshot replay on cols change
const REFLOW_SAFE_COLS_CHANGE_DEBOUNCE = 300 // ms

const RESIZE_REFIT_SETTLE_DELAY = 120  // ms second fit after layout settles
const FIT_RETRY_WHEN_HIDDEN_DELAY = 120  // ms retry when container briefly has 0 size

// xterm's buffer reflow corrupts at very narrow widths — rows get split into
// character-per-line stretched blocks that orphan in scrollback after the
// user drags the pane back wider. Skip fit if proposed cols would go below
// this floor; the pane stays visually narrow but the terminal keeps its
// previous cols (content clips on the right, but re-opens intact).
const MIN_SAFE_COLS = 20

interface UseTerminalFitParams {
  terminalRef: RefObject<XTerm | null>
  fitAddonRef: RefObject<FitAddon | null>
  containerRef: RefObject<HTMLDivElement | null>
  disposedRef: RefObject<boolean>
  scrollMachineRef: RefObject<TerminalScrollMachine>
  refreshVisibleRows: () => void
  /**
   * Part D (opt-in): Called (debounced) when terminal cols change after a fit, if the
   * reflowSafeScrollback setting is enabled. Caller triggers a silent snapshot replay
   * to rebuild the display from the raw PTY transcript at the new width.
   */
  onColsChanged?: () => void
  /**
   * Fired on the trailing edge of a resize gesture (drag-end / window-resize-end).
   * Used to trigger alt-buffer repaint after layout settles.
   */
  onResizeEnd?: () => void
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
    onColsChanged,
    onResizeEnd,
  } = params

  // Stable ref so handlers always see the latest onResizeEnd without stale closure
  const onResizeEndRef = useRef(onResizeEnd)
  onResizeEndRef.current = onResizeEnd

  const fitAnimationFrameRef = useRef<number | null>(null)
  const fitSettleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  // Part D: debounce timer for reflow-safe scrollback rebuild on cols change
  const reflowSafeDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  // Stable ref so performFit callback always sees the latest onColsChanged without stale closure
  const onColsChangedRef = useRef(onColsChanged)
  onColsChangedRef.current = onColsChanged

  const lastFitDimsRef = useRef<{ cols: number; rows: number } | null>(null)

  const performFit = useCallback((restoreViewport = true) => {
    const terminal = terminalRef.current
    const fitAddon = fitAddonRef.current
    const container = containerRef.current
    if (!terminal || !fitAddon || !container || disposedRef.current) return false
    if (container.clientWidth === 0 || container.clientHeight === 0) return false

    const savedViewportY = terminal.buffer.active.viewportY
    const wasAtBottom = scrollMachineRef.current.isAtBottom
    // Capture cols BEFORE fit to detect if cols actually changed (Part D)
    const prevCols = terminal.cols
    // I3: Track whether this is the very first fit call. On first mount, lastFitDimsRef
    // is null and prevCols defaults to xterm's 80-col initial value; comparing against
    // that would always fire onColsChanged even when the terminal hasn't been resized.
    const isFirstFit = lastFitDimsRef.current === null

    // Skip fit when proposed cols would corrupt xterm reflow.
    const proposed = fitAddon.proposeDimensions()
    if (proposed && proposed.cols < MIN_SAFE_COLS) return false

    try {
      fitAddon.fit()
    } catch {
      return false
    }

    lastFitDimsRef.current = { cols: terminal.cols, rows: terminal.rows }

    // Part D: if cols changed and reflowSafeScrollback is enabled, debounce a silent
    // snapshot replay so the caller can rebuild headless from raw at the new width.
    // The debounce resets on every performFit call while the user is still dragging —
    // the actual replay only fires when the width stabilises.
    // I3: Skip on first fit (mount) — prevCols is the xterm default, not a real resize.
    if (!isFirstFit && terminal.cols !== prevCols && onColsChangedRef.current) {
      // Read savedSettings (persisted source of truth) so toggling the switch
      // in the modal doesn't activate the behaviour until the user clicks Save.
      const reflowEnabled =
        useSettingsStore.getState().savedSettings.reflowSafeScrollback === true
      if (reflowEnabled) {
        if (reflowSafeDebounceRef.current) clearTimeout(reflowSafeDebounceRef.current)
        reflowSafeDebounceRef.current = setTimeout(() => {
          reflowSafeDebounceRef.current = null
          // Re-check at fire time — user may have disabled it during debounce window.
          if (useSettingsStore.getState().savedSettings.reflowSafeScrollback === true) {
            onColsChangedRef.current?.()
          }
        }, REFLOW_SAFE_COLS_CHANGE_DEBOUNCE)
      }
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

  // Defer fit() while a pane divider is being dragged. xterm's internal
  // reflow at rapidly-changing cols leaves wrapped rows orphaned in
  // scrollback — duplicated banners, character-per-line stretched blocks.
  // Gate fit on drag state: mark pending, flush on drag end.
  const fitPendingDuringDragRef = useRef(false)

  const fit = useCallback(() => {
    if (disposedRef.current) return
    if (isPaneDragging()) {
      fitPendingDuringDragRef.current = true
      return
    }
    cancelScheduledFit()
    fitAnimationFrameRef.current = requestAnimationFrame(() => {
      fitAnimationFrameRef.current = null
      // Drag may have started between fit() call and rAF firing — defer.
      if (isPaneDragging()) {
        fitPendingDuringDragRef.current = true
        return
      }
      // If performFit returned false because the container was 0×0 (pane
      // briefly hidden during layout), schedule one retry — otherwise cols
      // stay at the stale value and freshly-written wide content can appear
      // to overflow until the next user-triggered resize.
      if (!performFit()) {
        const container = containerRef.current
        const hiddenNow = !container || container.clientWidth === 0 || container.clientHeight === 0
        if (hiddenNow && !disposedRef.current) {
          fitSettleTimerRef.current = setTimeout(() => {
            fitSettleTimerRef.current = null
            if (isPaneDragging()) { fitPendingDuringDragRef.current = true; return }
            if (!performFit()) return
            fitSettleTimerRef.current = setTimeout(() => {
              fitSettleTimerRef.current = null
              if (isPaneDragging()) { fitPendingDuringDragRef.current = true; return }
              performFit()
            }, RESIZE_REFIT_SETTLE_DELAY)
          }, FIT_RETRY_WHEN_HIDDEN_DELAY)
        }
        return
      }
      // Settle pass: only run if the first fit actually changed cols/rows.
      // When the container is stable (e.g. initial mount at already-correct
      // size), the second fit would no-op at xterm level anyway — but skipping
      // it entirely avoids a needless timer and keeps the fit-burst tight so
      // the resize IPC debounce doesn't span across two frames.
      const firstDims = lastFitDimsRef.current
      fitSettleTimerRef.current = setTimeout(() => {
        fitSettleTimerRef.current = null
        const t = terminalRef.current
        if (!t || disposedRef.current) return
        if (isPaneDragging()) { fitPendingDuringDragRef.current = true; return }
        if (firstDims && t.cols === firstDims.cols && t.rows === firstDims.rows) {
          const c = containerRef.current
          if (!c) return
          // Only re-fit if container size drifted during settle window
          // (flex layout still animating). Otherwise skip — nothing to do.
          const prop = fitAddonRef.current?.proposeDimensions()
          if (!prop || (prop.cols === t.cols && prop.rows === t.rows)) return
        }
        performFit()
      }, RESIZE_REFIT_SETTLE_DELAY)
    })
  }, [cancelScheduledFit, containerRef, disposedRef, fitAddonRef, performFit, terminalRef])

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
    let trailingTimer: ReturnType<typeof setTimeout> | null = null
    const h = () => {
      fit()
      // Trailing-edge resize-end: fires once window stops resizing for 250ms
      if (trailingTimer) clearTimeout(trailingTimer)
      trailingTimer = setTimeout(() => {
        trailingTimer = null
        onResizeEndRef.current?.()
      }, 250)
    }
    window.addEventListener('resize', h)
    return () => {
      window.removeEventListener('resize', h)
      if (trailingTimer) clearTimeout(trailingTimer)
    }
  }, [fit])

  // When drag starts, cancel any already-scheduled fit so it can't fire
  // mid-drag. When drag ends, flush a pending fit at the final size.
  useEffect(() => {
    return subscribePaneDragging(() => {
      if (isPaneDragging()) {
        cancelScheduledFit()
        fitPendingDuringDragRef.current = true
        return
      }
      if (!fitPendingDuringDragRef.current) return
      fitPendingDuringDragRef.current = false
      fit()
      // Fire resize-end after fit settle (RESIZE_REFIT_SETTLE_DELAY=120ms + margin)
      setTimeout(() => onResizeEndRef.current?.(), RESIZE_REFIT_SETTLE_DELAY + 80)
    })
  }, [cancelScheduledFit, fit])

  // Part D: clean up reflow-safe debounce timer on unmount
  useEffect(() => {
    return () => {
      if (reflowSafeDebounceRef.current) {
        clearTimeout(reflowSafeDebounceRef.current)
        reflowSafeDebounceRef.current = null
      }
    }
  }, [])

  return { performFit, cancelScheduledFit, fit }
}
