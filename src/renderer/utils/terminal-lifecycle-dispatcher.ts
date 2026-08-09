/**
 * Terminal lifecycle event dispatcher — mirrors terminal-output-dispatcher.ts pattern.
 *
 * Provides a singleton listener for the `terminal:system-resumed` IPC event
 * (phase 4: auto-resync on lid-wake) and fans out to per-terminal subscribers.
 *
 * Usage:
 *   1. Call attachTerminalLifecycleDispatcher(window.electron.terminal.onSystemResumed)
 *      once at app bootstrap (App.tsx, alongside attachTerminalOutputDispatcher).
 *   2. In each terminal hook's useEffect, subscribe/unsubscribe per terminal ID.
 */

type SystemResumedCallback = () => void

// Per-terminal subscriber map: terminalId → callback
const systemResumeHandlers = new Map<string, SystemResumedCallback>()

/**
 * Subscribe a terminal to system-resume events.
 * Replaces any existing subscription for the same terminalId.
 */
export function subscribeToSystemResume(
  terminalId: string,
  callback: SystemResumedCallback
): void {
  systemResumeHandlers.set(terminalId, callback)
}

/**
 * Unsubscribe a terminal from system-resume events.
 * Safe to call if terminalId was never subscribed.
 */
export function unsubscribeFromSystemResume(terminalId: string): void {
  systemResumeHandlers.delete(terminalId)
}

/**
 * Attach the singleton IPC listener for system-resumed events.
 *
 * The `subscribe` parameter accepts the same signature as
 * `window.electron.terminal.onSystemResumed` — a function that registers a
 * callback and returns an unsubscribe closure.
 *
 * No dispatcher-level debounce is needed: the main process already debounces
 * with a 2000ms window before sending the IPC event. Each hook's
 * performSnapshotReplay() call is additionally guarded by the per-terminal
 * snapshotReplayMutex, so concurrent fires are harmlessly coalesced.
 *
 * @returns cleanup function that removes the IPC listener
 */
export function attachTerminalLifecycleDispatcher(
  subscribe: (callback: SystemResumedCallback) => () => void
): () => void {
  return subscribe(() => {
    // Fan out to all currently subscribed terminals
    for (const [, handler] of systemResumeHandlers) {
      try {
        handler()
      } catch (err) {
        // Guard: one failing handler must not block others
        console.error('[lifecycle-dispatcher] system-resume handler threw:', err)
      }
    }
  })
}

/**
 * Reset internal state — intended for unit tests only.
 * Must NOT be called from production code.
 */
export function resetLifecycleDispatcherForTests(): void {
  systemResumeHandlers.clear()
}
