/**
 * Tracks in-flight renderer-initiated terminal creates so external listeners
 * (e.g. the global `onCreated` IPC broadcast handler in App.tsx) can tell
 * whether a TERMINAL_CREATED event came from the renderer's own split / +new
 * paths or from an external source like Telegram /new.
 *
 * Renderer-initiated creates own their own pane-tree geometry (executeSplit
 * places the leaf at the requested split direction; handleAddTerminal builds
 * a balanced layout). The broadcast handler must NOT also stomp that geometry
 * with a flat rebuild — doing so produces the "split right 4 times → 3 columns
 * + 1 row underneath" bug, where the broadcast races ahead of the renderer's
 * setTree and resets the layout to a 2×2 grid before the proper split lands.
 *
 * Module-level counter (not a hook / store) because it must survive React
 * render cycles and be readable synchronously from inside an IPC callback.
 */
let inFlight = 0

/**
 * Mark a renderer-initiated create as starting. Returns a release callback
 * that decrements the counter — call it from the same code path that issued
 * the IPC create, regardless of success/failure, to avoid leaking the counter.
 */
export function beginRendererCreate(): () => void {
  inFlight += 1
  let released = false
  return () => {
    if (released) return
    released = true
    inFlight = Math.max(0, inFlight - 1)
  }
}

/** True while at least one renderer-initiated create is in flight. */
export function isRendererCreateInFlight(): boolean {
  return inFlight > 0
}

/** Test helper — reset to zero between tests. */
export function _resetRendererCreateTrackerForTests(): void {
  inFlight = 0
}
