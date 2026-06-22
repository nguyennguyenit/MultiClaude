/**
 * Global signal for "a pane divider is currently being dragged".
 *
 * Rapid drag fires ResizeObserver at display refresh rate on every affected
 * pane. Hooks use this signal to keep local xterm fit responsive while
 * suppressing expensive or stateful resize side effects until drag end.
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
