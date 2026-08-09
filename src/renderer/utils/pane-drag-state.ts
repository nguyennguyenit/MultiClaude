/**
 * Global signal for "a pane divider is currently being dragged".
 *
 * Rapid drag fires ResizeObserver at display refresh rate on every affected
 * pane. Each fire triggers xterm fit() → terminal.resize(cols, rows) → xterm
 * internal reflow. When the user drags the divider to a very narrow width
 * then back, xterm's reflow can leave wrapped rows orphaned in scrollback
 * (character-per-line stretched blocks, duplicated banners). Suspend fit()
 * for the duration of the drag and commit a single fit at rest position
 * when the drag ends.
 */
type Listener = () => void

let dragging = false
const listeners = new Set<Listener>()

export function isPaneDragging(): boolean {
  return dragging
}

export function setPaneDragging(value: boolean): void {
  if (dragging === value) return
  dragging = value
  for (const l of listeners) {
    try { l() } catch { /* ignore listener errors */ }
  }
}

export function subscribePaneDragging(listener: Listener): () => void {
  listeners.add(listener)
  return () => { listeners.delete(listener) }
}
