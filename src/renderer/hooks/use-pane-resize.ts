import { useCallback, useRef } from 'react'
import type { RefObject } from 'react'
import { PANE_RATIO_MAX, PANE_RATIO_MIN, type SplitOrientation } from '@shared/types'

export interface UsePaneResizeParams {
  orientation: SplitOrientation
  startRatio: number
  containerRef: RefObject<HTMLElement | null>
  onRatioChange: (ratio: number) => void
}

export interface UsePaneResizeResult {
  /** Attach this to the resize handle's `onPointerDown` with the pointer's client coordinate. */
  beginDrag: (startCoord: number) => void
}

function clampRatio(r: number): number {
  if (r < PANE_RATIO_MIN) return PANE_RATIO_MIN
  if (r > PANE_RATIO_MAX) return PANE_RATIO_MAX
  return r
}

/**
 * Drag-to-resize for a single split node.
 * Owns no state itself — delegates every ratio update to `onRatioChange`,
 * which should reach into the pane tree and call `updateRatio(tree, path, r)`.
 */
export function usePaneResize({
  orientation,
  startRatio,
  containerRef,
  onRatioChange
}: UsePaneResizeParams): UsePaneResizeResult {
  // Latest values are captured into closures at beginDrag time; refs let callers
  // avoid re-subscribing between renders.
  const orientationRef = useRef(orientation)
  const startRatioRef = useRef(startRatio)
  const onRatioChangeRef = useRef(onRatioChange)
  orientationRef.current = orientation
  startRatioRef.current = startRatio
  onRatioChangeRef.current = onRatioChange

  const beginDrag = useCallback(
    (startCoord: number) => {
      const container = containerRef.current
      if (!container) return
      const rect = container.getBoundingClientRect()
      const size = orientationRef.current === 'row' ? rect.width : rect.height
      if (!size) return
      const initial = startRatioRef.current
      const axis = orientationRef.current === 'row' ? 'clientX' : 'clientY'

      const onMove = (e: PointerEvent): void => {
        const delta = (e[axis] as number) - startCoord
        const next = clampRatio(initial + delta / size)
        onRatioChangeRef.current(next)
      }

      const onUp = (): void => {
        window.removeEventListener('pointermove', onMove)
        window.removeEventListener('pointerup', onUp)
      }

      window.addEventListener('pointermove', onMove)
      window.addEventListener('pointerup', onUp)
    },
    [containerRef]
  )

  return { beginDrag }
}
