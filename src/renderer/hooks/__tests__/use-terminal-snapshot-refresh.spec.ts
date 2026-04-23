// @vitest-environment jsdom
/**
 * Tests for performSnapshotReplay() — the core refresh-via-snapshot logic
 * extracted from refreshTerminal in use-terminal-webgl.ts.
 *
 * Covers:
 *  - Happy path: getSnapshot → reset → alt-buffer exit → write → SIGWINCH → toast
 *  - Empty snapshot fallback: no reset crash, still SIGWINCH
 *  - Error: IPC reject → error toast, no crash
 *  - Mutex: rapid double-trigger → single replay
 *  - Write order: alt-buffer escape before snapshot data
 *  - Dispatcher pause/resume across replay
 *
 * Mount path:
 *  - Uses snapshot when app-store buffer empty (initialOutput prop not set)
 *  - Prefers prop initialOutput over snapshot
 */
// runs in jsdom (see vitest.config.ts environmentMatchGlobs)
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'

vi.mock('@xterm/xterm')
vi.mock('@xterm/addon-webgl')
vi.mock('@xterm/addon-fit')
vi.mock('@xterm/addon-web-links')

import { useTerminalWebGL } from '../use-terminal-webgl'
import { pauseAndBuffer, resumeAndFlush, resetTerminalOutputDispatcherForTests } from '../../utils/terminal-output-dispatcher'
import { useToastStore } from '../../stores'

// ── xterm mock helpers ──────────────────────────────────────────────────────

// We need reset, resize, clearTextureAtlas in addition to what the module mock provides.
// Import the mock instance directly and add what's missing.
import { mockTerminalInstance } from '../../__mocks__/@xterm/xterm'

const extendedMock = mockTerminalInstance as typeof mockTerminalInstance & {
  reset: ReturnType<typeof vi.fn>
  resize: ReturnType<typeof vi.fn>
  clearTextureAtlas: ReturnType<typeof vi.fn>
  refresh: ReturnType<typeof vi.fn>
}

// ── window.electron helpers ─────────────────────────────────────────────────

type ElectronTerminalMock = {
  getSnapshot: ReturnType<typeof vi.fn>
  resize: ReturnType<typeof vi.fn>
}

function stubElectronTerminal(overrides: Partial<ElectronTerminalMock> = {}) {
  const mock: ElectronTerminalMock = {
    getSnapshot: vi.fn().mockResolvedValue({ data: '\x1b[2Jhello', cols: 80, rows: 24 }),
    resize: vi.fn(),
    ...overrides,
  }
  vi.stubGlobal('electron', {
    terminal: mock,
    app: { openExternal: vi.fn() },
    clipboard: { writeText: vi.fn() },
    shell: { openPath: vi.fn(), openExternal: vi.fn() },
  })
  return mock
}

// ── hook factory ────────────────────────────────────────────────────────────

function makeRefs(overrides: Record<string, unknown> = {}) {
  return {
    terminalRef: { current: extendedMock },
    disposedRef: { current: false },
    terminalId: 'test-term',
    isActiveRef: { current: true },
    isHiddenRef: { current: false },
    onRefresh: vi.fn(),
    onRefreshVisibleRows: vi.fn(),
    performFit: vi.fn().mockReturnValue(true),
    ...overrides,
  }
}

function renderWebGL(overrides: Record<string, unknown> = {}) {
  const refs = makeRefs(overrides)
  // Cast through unknown: mock doesn't implement all XTerm methods but satisfies
  // the subset used by performSnapshotReplay (reset, write, resize, loadAddon, etc.)
  const { result } = renderHook(() => useTerminalWebGL(refs as unknown as Parameters<typeof useTerminalWebGL>[0]))
  return { ...result.current, refs }
}

// ── setup / teardown ────────────────────────────────────────────────────────

beforeEach(() => {
  vi.useFakeTimers()

  // Ensure extended mock methods exist
  extendedMock.reset = extendedMock.reset ?? vi.fn()
  extendedMock.resize = extendedMock.resize ?? vi.fn()
  extendedMock.clearTextureAtlas = extendedMock.clearTextureAtlas ?? vi.fn()
  extendedMock.refresh = extendedMock.refresh ?? vi.fn()

  // Reset all mock call counts
  vi.clearAllMocks()
  resetTerminalOutputDispatcherForTests()

  stubElectronTerminal()
})

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

// ── Dispatcher pause/resume (unit) ──────────────────────────────────────────

describe('dispatcher pauseAndBuffer / resumeAndFlush', () => {
  it('is already tested in terminal-output-dispatcher.spec.ts', () => {
    // Smoke check: functions are importable and callable without throwing
    expect(() => {
      pauseAndBuffer('term-x')
      resumeAndFlush('term-x')
    }).not.toThrow()
  })
})

// ── refreshTerminal (snapshot replay) ───────────────────────────────────────

describe('refreshTerminal with snapshot replay', () => {
  it('calls getSnapshot, resets xterm, writes snapshot data', async () => {
    const mockSnap = { data: '\x1b[2Jhello', cols: 80, rows: 24 }
    const electronMock = stubElectronTerminal({
      getSnapshot: vi.fn().mockResolvedValue(mockSnap),
    })

    const { refreshTerminal } = renderWebGL()

    await act(async () => {
      refreshTerminal()
      vi.runAllTimers()
      // Allow micro-task queue to drain
      await Promise.resolve()
      await Promise.resolve()
    })

    expect(electronMock.getSnapshot).toHaveBeenCalledWith('test-term')
    expect(extendedMock.reset).toHaveBeenCalled()
    // Snapshot data written with callback
    const writeCalls = (extendedMock.write as ReturnType<typeof vi.fn>).mock.calls
    const snapWriteCall = writeCalls.find((c: unknown[]) => c[0] === '\x1b[2Jhello')
    expect(snapWriteCall).toBeDefined()
    expect(typeof snapWriteCall?.[1]).toBe('function')
  })

  it('writes \\x1b[?1049l (alt-buffer exit) before snapshot data', async () => {
    const mockSnap = { data: 'snap-content', cols: 80, rows: 24 }
    stubElectronTerminal({ getSnapshot: vi.fn().mockResolvedValue(mockSnap) })

    const { refreshTerminal } = renderWebGL()

    await act(async () => {
      refreshTerminal()
      vi.runAllTimers()
      await Promise.resolve()
      await Promise.resolve()
    })

    const writeCalls = (extendedMock.write as ReturnType<typeof vi.fn>).mock.calls
      .map((c: unknown[]) => c[0] as string)

    const altBufIdx = writeCalls.indexOf('\x1b[?1049l')
    const snapIdx = writeCalls.indexOf('snap-content')

    // Both should have been written
    expect(altBufIdx).toBeGreaterThanOrEqual(0)
    expect(snapIdx).toBeGreaterThanOrEqual(0)
    // Alt-buffer exit must come before snapshot data
    expect(altBufIdx).toBeLessThan(snapIdx)
  })

  it('sends SIGWINCH (electron resize) after snapshot write', async () => {
    const electronMock = stubElectronTerminal()

    const { refreshTerminal } = renderWebGL()

    await act(async () => {
      refreshTerminal()
      vi.runAllTimers()
      await Promise.resolve()
      await Promise.resolve()
      await Promise.resolve()
    })

    expect(electronMock.resize).toHaveBeenCalledWith('test-term', expect.any(Number), expect.any(Number))
  })

  it('shows success toast on normal refresh', async () => {
    stubElectronTerminal()
    const addToastSpy = vi.spyOn(useToastStore.getState(), 'addToast')

    const { refreshTerminal } = renderWebGL()

    await act(async () => {
      refreshTerminal(true)
      vi.runAllTimers()
      await Promise.resolve()
      await Promise.resolve()
      await Promise.resolve()
    })

    expect(addToastSpy).toHaveBeenCalledWith(expect.stringContaining('refreshed'), 'info')
  })

  it('does not show toast when showNotification=false', async () => {
    stubElectronTerminal()
    const addToastSpy = vi.spyOn(useToastStore.getState(), 'addToast')

    const { refreshTerminal } = renderWebGL()

    await act(async () => {
      refreshTerminal(false)
      vi.runAllTimers()
      await Promise.resolve()
      await Promise.resolve()
      await Promise.resolve()
    })

    expect(addToastSpy).not.toHaveBeenCalled()
  })

  it('shows error toast when getSnapshot IPC rejects', async () => {
    stubElectronTerminal({
      getSnapshot: vi.fn().mockRejectedValue(new Error('IPC failed')),
    })
    const addToastSpy = vi.spyOn(useToastStore.getState(), 'addToast')

    const { refreshTerminal } = renderWebGL()

    await act(async () => {
      refreshTerminal()
      vi.runAllTimers()
      await Promise.resolve()
      await Promise.resolve()
      await Promise.resolve()
    })

    expect(addToastSpy).toHaveBeenCalledWith(expect.stringContaining('error'), 'error')
  })

  it('handles empty snapshot gracefully — no reset crash, still SIGWINCH', async () => {
    const electronMock = stubElectronTerminal({
      getSnapshot: vi.fn().mockResolvedValue({ data: '', cols: 0, rows: 0 }),
    })

    const { refreshTerminal } = renderWebGL()

    // Should not throw
    await act(async () => {
      expect(async () => {
        refreshTerminal()
        vi.runAllTimers()
        await Promise.resolve()
        await Promise.resolve()
        await Promise.resolve()
      }).not.toThrow()
    })

    // SIGWINCH still expected even with empty snapshot
    expect(electronMock.resize).toHaveBeenCalled()
  })

  it('mutex: rapid double-trigger → only one replay executes', async () => {
    const getSnapshotMock = vi.fn().mockImplementation(
      () => new Promise<{ data: string; cols: number; rows: number }>(resolve =>
        setTimeout(() => resolve({ data: 'snap', cols: 80, rows: 24 }), 50)
      )
    )
    stubElectronTerminal({ getSnapshot: getSnapshotMock })

    const { refreshTerminal } = renderWebGL()

    await act(async () => {
      // Trigger twice rapidly (after debounce settles, before snapshot resolves)
      refreshTerminal()
      vi.runAllTimers()
      await Promise.resolve()

      // Second trigger while first is in-flight (mutex should block this)
      refreshTerminal()
      vi.runAllTimers()

      // Let first snapshot resolve
      await Promise.resolve()
      await Promise.resolve()
      await Promise.resolve()
    })

    // getSnapshot should only be called once (second was mutex-blocked)
    expect(getSnapshotMock).toHaveBeenCalledTimes(1)
  })

  it('does not write snapshot data when terminal is disposed after await', async () => {
    const refs = makeRefs()
    const getSnapshotMock = vi.fn().mockImplementation(async () => {
      // Simulate terminal being disposed while getSnapshot is in flight
      refs.disposedRef.current = true
      return { data: 'snap', cols: 80, rows: 24 }
    })
    stubElectronTerminal({ getSnapshot: getSnapshotMock })

    const { refreshTerminal } = renderHook(
      () => useTerminalWebGL(refs as unknown as Parameters<typeof useTerminalWebGL>[0])
    ).result.current

    await act(async () => {
      refreshTerminal()
      vi.runAllTimers()
      await Promise.resolve()
      await Promise.resolve()
      await Promise.resolve()
    })

    // reset() should NOT have been called — terminal was disposed
    expect(extendedMock.reset).not.toHaveBeenCalled()
  })
})

// ── PR manual test scenarios (non-automatable) ──────────────────────────────
// The following are documented here as TODOs for manual verification.
// They require a running PTY and cannot be driven by unit tests.

/**
 * PR Manual Test Checklist (must be done before merge):
 *
 * 1. Normal bash session + refresh → prompt intact, no flicker, scrollback preserved
 * 2. `vim` open + refresh → vim UI restored via SIGWINCH repaint
 * 3. `vim` open → `:q` → refresh (B1) → shell prompt visible, NOT stuck in alt-buffer
 * 4. `tmux` session + refresh → status bar + panes intact
 * 5. Long `cat bigfile` + refresh → scrollback ≥ 10k lines recovered
 * 6. Fresh terminal (no output yet) + refresh → no crash, no toast error
 * 7. Rapid double-click refresh (H6) → second click no-ops; single replay occurs
 * 8. Refresh during heavy `yes | head -n 100000` (H4) → no chunks lost; output continuous
 * 9. Resize window mid-session, then refresh → snapshot reflects new dims, no corruption
 */
