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

interface SystemResumeSubscription {
  token: symbol
  callback: SystemResumedCallback
}

const systemResumeHandlers = new Map<string, SystemResumeSubscription>()

/**
 * Subscribe a terminal to system-resume events.
 * Replaces any existing subscription for the same terminalId.
 */
export function subscribeToSystemResume(
  terminalId: string,
  tokenOrCallback: symbol | SystemResumedCallback,
  maybeCallback?: SystemResumedCallback,
): () => void {
  const token = typeof tokenOrCallback === 'symbol' ? tokenOrCallback : Symbol('legacy-session')
  const callback = typeof tokenOrCallback === 'function' ? tokenOrCallback : maybeCallback
  if (!callback) return () => undefined
  const subscription = { token, callback }
  systemResumeHandlers.set(terminalId, subscription)
  return () => {
    if (systemResumeHandlers.get(terminalId) === subscription) {
      systemResumeHandlers.delete(terminalId)
    }
  }
}

/**
 * Unsubscribe a terminal from system-resume events.
 * Safe to call if terminalId was never subscribed.
 */
export function unsubscribeFromSystemResume(terminalId: string, token?: symbol): void {
  const subscription = systemResumeHandlers.get(terminalId)
  if (!subscription || (token !== undefined && subscription.token !== token)) return
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
    for (const [, { callback }] of systemResumeHandlers) {
      try {
        callback()
      } catch {
        // Guard: one failing handler must not block others
        console.error('[lifecycle-dispatcher] System-resume handler failed.')
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
