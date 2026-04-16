import type { PointerEvent as ReactPointerEvent, KeyboardEvent as ReactKeyboardEvent } from 'react'
import { PANE_RATIO_MAX, PANE_RATIO_MIN } from '@shared/types'

interface ResizeHandleProps {
  /** 'horizontal' = drag up/down to resize rows, 'vertical' = drag left/right to resize cols */
  direction: 'horizontal' | 'vertical'
  onResizeStart: (e: ReactPointerEvent<HTMLDivElement>) => void
  /** Current split ratio — drives ARIA reporting + keyboard adjustment base. */
  currentRatio: number
  /** Called when user adjusts ratio via keyboard. Consumer applies the same
   *  clamp + min-pane-pixel guard as the pointer path. */
  onAdjust: (ratio: number) => void
}

const COARSE_STEP = 0.05
const FINE_STEP = 0.01

/** Draggable divider between terminal panes for resizing rows or columns */
export function ResizeHandle({ direction, onResizeStart, currentRatio, onAdjust }: ResizeHandleProps) {
  function handleKeyDown(e: ReactKeyboardEvent<HTMLDivElement>): void {
    const step = e.shiftKey ? FINE_STEP : COARSE_STEP
    let delta = 0
    if (direction === 'vertical') {
      if (e.key === 'ArrowLeft') delta = -step
      else if (e.key === 'ArrowRight') delta = step
      else return
    } else {
      if (e.key === 'ArrowUp') delta = -step
      else if (e.key === 'ArrowDown') delta = step
      else return
    }
    e.preventDefault()
    onAdjust(currentRatio + delta)
  }

  return (
    <div
      className={`terminal-resize-handle terminal-resize-handle--${direction}`}
      data-direction={direction}
      role="separator"
      tabIndex={0}
      aria-orientation={direction === 'vertical' ? 'vertical' : 'horizontal'}
      aria-valuenow={currentRatio}
      aria-valuemin={PANE_RATIO_MIN}
      aria-valuemax={PANE_RATIO_MAX}
      onKeyDown={handleKeyDown}
      onPointerDown={(e) => {
        e.preventDefault()
        onResizeStart(e)
      }}
    />
  )
}
