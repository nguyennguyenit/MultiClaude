/**
 * Main-process resume debounce helper.
 *
 * powerMonitor on macOS is known to double-fire 'resume' events within a short
 * window. This module provides a pure, testable function that decides whether a
 * given resume event should be forwarded to renderer windows.
 *
 * Debounce window: 2000ms — only the first event within any 2s window is forwarded.
 */

export const RESUME_DEBOUNCE_MS = 2000

// Module-level state: timestamp of the last forwarded resume event.
// Initialized to 0 so the very first call is always allowed.
let lastResumeAt = 0

/**
 * Decide whether a resume event fired at `now` ms should be forwarded.
 *
 * Side-effect: updates `lastResumeAt` when the event is allowed.
 *
 * @param now - current timestamp (Date.now())
 * @returns true if the event should be forwarded, false if within debounce window
 */
export function shouldForwardResume(now: number): boolean {
  if (now - lastResumeAt < RESUME_DEBOUNCE_MS) return false
  lastResumeAt = now
  return true
}

/**
 * Reset internal state — intended for unit tests only.
 * Must NOT be called from production code.
 */
export function resetResumeDebounceForTests(): void {
  lastResumeAt = 0
}
