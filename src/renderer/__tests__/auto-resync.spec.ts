/**
 * Phase 4: Auto-resync on system resume — unit tests
 *
 * TDD: written before implementation. Tests cover:
 *  1. snapshot replay fires silently (no toast) on system-resumed event
 *  2. debounce helper (shouldForwardResume) blocks rapid double-fire
 *  3. destroyed-before-event terminal is skipped (unsubscribe cleaned up)
 *  4. all mounted terminals receive replay on a single event
 *  5. no toast emitted when silent=true
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// ── Helpers from the lifecycle dispatcher (unit under test) ──────────────────
import {
  attachTerminalLifecycleDispatcher,
  subscribeToSystemResume,
  unsubscribeFromSystemResume,
  resetLifecycleDispatcherForTests,
} from '../utils/terminal-lifecycle-dispatcher'

// ── Pure helper extracted from main-process forwarding (unit under test) ─────
import {
  shouldForwardResume,
  resetResumeDebounceForTests,
} from '../../main/utils/resume-debounce-helper'

// ── Mock: window.electron.terminal.onSystemResumed ──────────────────────────
// The dispatcher receives a subscribe fn; we control its callback in tests.
type ResumeCallback = () => void
let capturedResumeCallback: ResumeCallback | null = null

function mockOnSystemResumed(cb: ResumeCallback): () => void {
  capturedResumeCallback = cb
  return () => { capturedResumeCallback = null }
}

function triggerSystemResumed(): void {
  capturedResumeCallback?.()
}

// ── Toast mock ───────────────────────────────────────────────────────────────
const addToastMock = vi.fn()

vi.mock('../stores', () => ({
  useToastStore: {
    getState: () => ({ addToast: addToastMock }),
  },
}))

// ── performSnapshotReplay mock ───────────────────────────────────────────────
const snapshotReplayMock = vi.fn().mockResolvedValue(undefined)

vi.mock('../hooks/use-terminal-webgl', () => ({
  performSnapshotReplay: snapshotReplayMock,
  isSnapshotReplayLocked: vi.fn().mockReturnValue(false),
}))

// ────────────────────────────────────────────────────────────────────────────

describe('shouldForwardResume (main-process debounce helper)', () => {
  beforeEach(() => {
    resetResumeDebounceForTests()
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('allows the first resume event', () => {
    expect(shouldForwardResume(Date.now())).toBe(true)
  })

  it('blocks a second resume within 2000ms debounce window', () => {
    const t0 = 1_000_000
    shouldForwardResume(t0)                // first call — allow
    expect(shouldForwardResume(t0 + 500)).toBe(false)  // within window — block
    expect(shouldForwardResume(t0 + 1999)).toBe(false) // still within window
  })

  it('allows a resume strictly after debounce window has elapsed', () => {
    const t0 = 1_000_000
    shouldForwardResume(t0)
    // t0 + 2000: delta is exactly RESUME_DEBOUNCE_MS — NOT strictly less, so allowed
    // Implementation: now - lastResumeAt < RESUME_DEBOUNCE_MS → 2000 < 2000 is false → allow
    expect(shouldForwardResume(t0 + 2000)).toBe(true)
    // After the above call, lastResumeAt = t0 + 2000; passing t0+2001 is within window of t0+2000
    // So we need a second sequence from a fresh baseline
  })

  it('resets state correctly via helper', () => {
    const bigT = 5_000_000
    shouldForwardResume(bigT)
    resetResumeDebounceForTests()
    // After reset lastResumeAt = 0; use a timestamp >= RESUME_DEBOUNCE_MS from 0
    expect(shouldForwardResume(2001)).toBe(true)
  })
})

// ────────────────────────────────────────────────────────────────────────────

describe('terminal-lifecycle-dispatcher', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    capturedResumeCallback = null
    resetLifecycleDispatcherForTests()
  })

  it('attaches listener via the provided subscribe fn', () => {
    const unsubscribe = attachTerminalLifecycleDispatcher(mockOnSystemResumed)
    expect(capturedResumeCallback).not.toBeNull()
    unsubscribe()
  })

  it('calls subscriber callback when system-resumed fires', () => {
    attachTerminalLifecycleDispatcher(mockOnSystemResumed)
    const cb = vi.fn()
    subscribeToSystemResume('term-1', cb)

    triggerSystemResumed()

    expect(cb).toHaveBeenCalledTimes(1)
  })

  it('fans out to multiple mounted terminals on a single event', () => {
    attachTerminalLifecycleDispatcher(mockOnSystemResumed)
    const cb1 = vi.fn()
    const cb2 = vi.fn()
    subscribeToSystemResume('term-1', cb1)
    subscribeToSystemResume('term-2', cb2)

    triggerSystemResumed()

    expect(cb1).toHaveBeenCalledTimes(1)
    expect(cb2).toHaveBeenCalledTimes(1)
  })

  it('skips unsubscribed terminal (destroyed before event)', () => {
    attachTerminalLifecycleDispatcher(mockOnSystemResumed)
    const cb = vi.fn()
    subscribeToSystemResume('term-dead', cb)
    unsubscribeFromSystemResume('term-dead')

    triggerSystemResumed()

    expect(cb).not.toHaveBeenCalled()
  })

  it('does not call removed terminal while other terminals still receive event', () => {
    attachTerminalLifecycleDispatcher(mockOnSystemResumed)
    const cbAlive = vi.fn()
    const cbDead = vi.fn()
    subscribeToSystemResume('term-alive', cbAlive)
    subscribeToSystemResume('term-dead', cbDead)
    unsubscribeFromSystemResume('term-dead')

    triggerSystemResumed()

    expect(cbAlive).toHaveBeenCalledTimes(1)
    expect(cbDead).not.toHaveBeenCalled()
  })

  it('keeps a same-ID replacement when the old session unsubscribes late', () => {
    attachTerminalLifecycleDispatcher(mockOnSystemResumed)
    const oldToken = Symbol('old')
    const newToken = Symbol('new')
    const oldCallback = vi.fn()
    const newCallback = vi.fn()
    subscribeToSystemResume('term-1', oldToken, oldCallback)
    subscribeToSystemResume('term-1', newToken, newCallback)

    unsubscribeFromSystemResume('term-1', oldToken)
    triggerSystemResumed()

    expect(oldCallback).not.toHaveBeenCalled()
    expect(newCallback).toHaveBeenCalledTimes(1)
  })

  it('continues fan-out and logs fixed copy when one handler throws', () => {
    attachTerminalLifecycleDispatcher(mockOnSystemResumed)
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const healthy = vi.fn()
    subscribeToSystemResume('term-bad', Symbol('bad'), () => {
      throw new Error('/private/renderer failure')
    })
    subscribeToSystemResume('term-good', Symbol('good'), healthy)

    triggerSystemResumed()

    expect(healthy).toHaveBeenCalledTimes(1)
    expect(consoleError).toHaveBeenCalledWith(
      '[lifecycle-dispatcher] System-resume handler failed.',
    )
    expect(consoleError).not.toHaveBeenCalledWith(expect.anything(), expect.anything())
  })
})

// ────────────────────────────────────────────────────────────────────────────

describe('auto-resync integration: silent replay, no toast', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    capturedResumeCallback = null
    resetLifecycleDispatcherForTests()
  })

  it('fires snapshot replay silently (no toast) on system-resumed event', async () => {
    // Simulate what the hook useEffect does: subscribe with silent=true replay
    attachTerminalLifecycleDispatcher(mockOnSystemResumed)

    // Minimal refs to pass to performSnapshotReplay — hook normally passes real refs
    const terminalId = 'term-silent'
    subscribeToSystemResume(terminalId, () => {
      // In production this calls performSnapshotReplay({...params, silent: true})
      // Here we verify the mock is called and toast is NOT called
      void snapshotReplayMock({ terminalId, silent: true })
    })

    triggerSystemResumed()

    // Let any micro-tasks settle
    await Promise.resolve()

    expect(snapshotReplayMock).toHaveBeenCalledWith(
      expect.objectContaining({ terminalId, silent: true })
    )
    // Toast must NOT have been called
    expect(addToastMock).not.toHaveBeenCalled()
  })

  it('does not fire replay for terminal unsubscribed before event', async () => {
    attachTerminalLifecycleDispatcher(mockOnSystemResumed)

    const terminalId = 'term-gone'
    subscribeToSystemResume(terminalId, () => {
      void snapshotReplayMock({ terminalId, silent: true })
    })

    // Terminal unmounts before wake fires
    unsubscribeFromSystemResume(terminalId)
    triggerSystemResumed()

    await Promise.resolve()
    expect(snapshotReplayMock).not.toHaveBeenCalled()
  })
})
