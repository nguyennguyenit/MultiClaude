import { useCallback, useEffect, useRef } from 'react'
import type { RefObject } from 'react'
import { PANE_RATIO_MAX, PANE_RATIO_MIN, type SplitOrientation } from '@shared/types'

export interface UsePaneResizeParams {
  orientation: SplitOrientation
  startRatio: number
  containerRef: RefObject<HTMLElement | null>
  onRatioChange: (ratio: number) => void
  /** Absolute minimum pane pixel size. xterm renders poorly below ~80 px, so
   *  we derive tighter ratio bounds than PANE_RATIO_MIN when the container
   *  is large enough to honor both. Defaults to 80. */
  minPanePx?: number
}

const DEFAULT_MIN_PANE_PX = 80

/**
 * Minimal subset of a React PointerEvent the hook needs. Keeps tests light
 * (no need to fabricate a full React SyntheticEvent) and lets us accept the
 * DOM PointerEvent from `onPointerDown` directly.
 */
export interface PaneResizePointerDown {
  pointerId: number
  clientX: number
  clientY: number
  currentTarget: HTMLElement
}

export interface UsePaneResizeResult {
  /**
   * Pass as `onPointerDown` on the resize handle. Uses `setPointerCapture`
   * so all subsequent pointer events target the handle until drag ends,
   * avoiding focus-steal and the need for global window listeners.
   */
  beginDrag: (e: PaneResizePointerDown) => void
}

function clampRatio(r: number): number {
  if (r < PANE_RATIO_MIN) return PANE_RATIO_MIN
  if (r > PANE_RATIO_MAX) return PANE_RATIO_MAX
  return r
}

function clampRatioWithMinPx(r: number, totalPx: number, minPanePx: number): number {
  if (totalPx <= minPanePx * 2) return clampRatio(r)
  const minRatio = Math.max(PANE_RATIO_MIN, minPanePx / totalPx)
  const maxRatio = Math.min(PANE_RATIO_MAX, 1 - minPanePx / totalPx)
  if (minRatio > maxRatio) return 0.5
  if (r < minRatio) return minRatio
  if (r > maxRatio) return maxRatio
  return r
}

/**
 * Drag-to-resize for a single split node.
 * Owns no state itself — delegates every ratio update to `onRatioChange`,
 * which should reach into the pane tree and call `updateRatio(tree, path, r)`.
 *
 * Lifecycle notes:
 * - Pointer capture + element-scoped listeners so mid-drag unmount of this
 *   component, via the cleanup ref below, tears them down instead of leaving
 *   zombie handlers writing into a now-invalid closure.
 * - Re-reads the container rect inside `onMove` so mid-drag window resizes
 *   (dock snap, responsive split) don't drift cursor vs. ratio.
 */
export function usePaneResize({
  orientation,
  startRatio,
  containerRef,
  onRatioChange,
  minPanePx = DEFAULT_MIN_PANE_PX
}: UsePaneResizeParams): UsePaneResizeResult {
  const orientationRef = useRef(orientation)
  const startRatioRef = useRef(startRatio)
  const onRatioChangeRef = useRef(onRatioChange)
  const minPanePxRef = useRef(minPanePx)
  orientationRef.current = orientation
  startRatioRef.current = startRatio
  onRatioChangeRef.current = onRatioChange
  minPanePxRef.current = minPanePx

  const cleanupRef = useRef<(() => void) | null>(null)

  useEffect(() => {
    return () => {
      cleanupRef.current?.()
      cleanupRef.current = null
    }
  }, [])

  const beginDrag = useCallback(
    (e: PaneResizePointerDown) => {
      const container = containerRef.current
      if (!container) return
      const target = e.currentTarget
      const pointerId = e.pointerId
      const axis = orientationRef.current === 'row' ? 'clientX' : 'clientY'
      const startCoord = e[axis]
      const initial = startRatioRef.current

      // Tear down any prior in-flight drag (defensive — shouldn't normally happen).
      cleanupRef.current?.()

      try {
        target.setPointerCapture?.(pointerId)
      } catch {
        // Some environments (jsdom, exotic pointer types) may throw; ignore.
      }

      // rAF-coalesce ratio updates so React/Zustand state churn (and the
      // ResizeObserver → fit() → SIGWINCH chain it triggers in every pane) is
      // capped at the display refresh rate. Without this, fast pointermove
      // bursts can fire 100+ Hz on high-poll-rate trackpads, drowning the
      // renderer in re-flow work and making the drag feel like it lags behind
      // the cursor.
      let pendingRatio: number | null = null
      let scheduledFrame: number | null = null
      const flushPending = (): void => {
        scheduledFrame = null
        if (pendingRatio === null) return
        const r = pendingRatio
        pendingRatio = null
        onRatioChangeRef.current(r)
      }
      const onMove = (moveEvent: Event): void => {
        const pe = moveEvent as PointerEvent
        const rect = container.getBoundingClientRect()
        const size = orientationRef.current === 'row' ? rect.width : rect.height
        if (!size) return
        const delta = (axis === 'clientX' ? pe.clientX : pe.clientY) - startCoord
        pendingRatio = clampRatioWithMinPx(initial + delta / size, size, minPanePxRef.current)
        if (scheduledFrame === null) {
          scheduledFrame = requestAnimationFrame(flushPending)
        }
      }

      const cleanup = (): void => {
        if (scheduledFrame !== null) {
          cancelAnimationFrame(scheduledFrame)
          scheduledFrame = null
        }
        // Commit any pending ratio so the final rest position isn't lost
        // when pointerup races ahead of the queued rAF.
        flushPending()
        target.removeEventListener('pointermove', onMove)
        target.removeEventListener('pointerup', onEnd)
        target.removeEventListener('pointercancel', onEnd)
        try {
          target.releasePointerCapture?.(pointerId)
        } catch {
          // ignore
        }
        cleanupRef.current = null
      }

      const onEnd = (): void => cleanup()

      target.addEventListener('pointermove', onMove)
      target.addEventListener('pointerup', onEnd)
      target.addEventListener('pointercancel', onEnd)
      cleanupRef.current = cleanup
    },
    [containerRef]
  )

  return { beginDrag }
}
