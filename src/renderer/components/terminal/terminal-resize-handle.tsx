interface ResizeHandleProps {
  /** 'horizontal' = drag up/down to resize rows, 'vertical' = drag left/right to resize cols */
  direction: 'horizontal' | 'vertical'
  onResizeStart: (clientPos: number) => void
}

/** Draggable divider between terminal panes for resizing rows or columns */
export function ResizeHandle({ direction, onResizeStart }: ResizeHandleProps) {
  return (
    <div
      className={`terminal-resize-handle terminal-resize-handle--${direction}`}
      onPointerDown={(e) => {
        e.preventDefault()
        onResizeStart(direction === 'horizontal' ? e.clientY : e.clientX)
      }}
    />
  )
}
