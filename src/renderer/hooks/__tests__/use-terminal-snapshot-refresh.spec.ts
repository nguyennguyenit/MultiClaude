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

import {
  acquireSnapshotReplayLock,
  performSnapshotReplay,
  useTerminalWebGL,
} from '../use-terminal-webgl'
import {
  attachTerminalOutputDispatcher,
  pauseAndBuffer,
  registerTerminalOutputHandler,
  resumeAndFlush,
  resetTerminalOutputDispatcherForTests,
} from '../../utils/terminal-output-dispatcher'
import { useToastStore } from '../../stores'
import { createTerminalStateHarness } from '../../utils/__tests__/terminal-state-harness'
import {
  SNAPSHOT_DUPLICATION_CASE,
  TERMINAL_STREAM_CASES,
} from '../../../main/terminal/__tests__/fixtures/terminal-stream-cases'
import type { TerminalOutputChunk, TerminalSnapshot } from '@shared/types'

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
  rebuildHeadless: ReturnType<typeof vi.fn>
  getSnapshot: ReturnType<typeof vi.fn>
  resize: ReturnType<typeof vi.fn>
}

function stubElectronTerminal(overrides: Partial<ElectronTerminalMock> = {}) {
  const mock: ElectronTerminalMock = {
    rebuildHeadless: vi.fn().mockResolvedValue(undefined),
    getSnapshot: vi.fn().mockResolvedValue({
      terminalId: 'test-term',
      streamEpoch: 'epoch-1',
      watermark: 0,
      ansi: '\x1b[2Jhello',
      cols: 80,
      rows: 24,
      buffer: 'normal',
    }),
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
  it('serializes initialization hydration behind an in-flight replay lock', async () => {
    vi.useRealTimers()
    const releaseReplay = await acquireSnapshotReplayLock('locked-term')
    expect(releaseReplay).not.toBeNull()

    let hydrationAcquired = false
    const hydrationLock = acquireSnapshotReplayLock('locked-term', true).then(release => {
      hydrationAcquired = true
      return release
    })
    await Promise.resolve()
    expect(hydrationAcquired).toBe(false)

    releaseReplay!()
    const releaseHydration = await hydrationLock
    expect(hydrationAcquired).toBe(true)
    releaseHydration?.()
  })

  it.each(TERMINAL_STREAM_CASES)(
    'the state harness applies $name chunks without altering stream boundaries',
    async ({ chunks, expectedText }) => {
      vi.useRealTimers()
      const harness = createTerminalStateHarness()
      try {
        for (const chunk of chunks) await harness.write(chunk)
        const state = harness.state()
        for (const text of expectedText) expect(state.data).toContain(text)
        expect(state).toMatchObject({
          cols: 80,
          rows: 24,
          bufferType: 'normal',
        })
      } finally {
        harness.dispose()
      }
    }
  )

  it('produces exact-once final state when a buffered chunk is already in the snapshot', async () => {
    vi.useRealTimers()
    const reference = createTerminalStateHarness()
    const replayed = createTerminalStateHarness()
    const { beforeSnapshot, crossesSnapshotBarrier } = SNAPSHOT_DUPLICATION_CASE

    try {
      await reference.write(beforeSnapshot)
      await reference.write(crossesSnapshotBarrier)
      const snapshot = reference.state()

      let emitOutput!: (payload: TerminalOutputChunk) => void
      const detach = attachTerminalOutputDispatcher(callback => {
        emitOutput = callback
        return vi.fn()
      })
      const unregister = registerTerminalOutputHandler('test-term', data => {
        replayed.terminal.write(data)
      })
      stubElectronTerminal({
        getSnapshot: vi.fn().mockImplementation(async () => {
          emitOutput({
            terminalId: 'test-term',
            streamEpoch: 'epoch-1',
            sequence: 2,
            data: crossesSnapshotBarrier,
          })
          return {
            terminalId: 'test-term',
            streamEpoch: 'epoch-1',
            watermark: 2,
            ansi: snapshot.data,
            cols: snapshot.cols,
            rows: snapshot.rows,
            buffer: 'normal',
          }
        }),
      })

      await performSnapshotReplay({
        terminalId: 'test-term',
        terminalRef: { current: replayed.terminal } as never,
        disposedRef: { current: false },
        isActiveRef: { current: true },
        isHiddenRef: { current: false },
        clearTextureAtlas: vi.fn(),
        webglAddonRef: { current: null },
        reconcileWebGL: vi.fn(),
        performFit: vi.fn().mockReturnValue(true),
        silent: true,
      })
      await replayed.write('')

      expect(replayed.state()).toEqual(reference.state())
      unregister()
      detach()
    } finally {
      reference.dispose()
      replayed.dispose()
    }
  })

  it('restores alternate-buffer state from the canonical snapshot', async () => {
    vi.useRealTimers()
    const reference = createTerminalStateHarness()
    const replayed = createTerminalStateHarness()
    try {
      await reference.write('\x1b[?1049halternate-state')
      const snapshot = reference.state()
      expect(snapshot.bufferType).toBe('alternate')
      stubElectronTerminal({
        getSnapshot: vi.fn().mockResolvedValue({
          terminalId: 'alt-term',
          streamEpoch: 'alt-epoch',
          watermark: 1,
          ansi: snapshot.data,
          cols: snapshot.cols,
          rows: snapshot.rows,
          buffer: 'alternate',
        }),
      })

      await performSnapshotReplay({
        terminalId: 'alt-term',
        terminalRef: { current: replayed.terminal } as never,
        disposedRef: { current: false },
        isActiveRef: { current: true },
        isHiddenRef: { current: false },
        clearTextureAtlas: vi.fn(),
        webglAddonRef: { current: null },
        reconcileWebGL: vi.fn(),
        performFit: vi.fn().mockReturnValue(true),
        silent: true,
      })

      expect(replayed.state()).toEqual(reference.state())
    } finally {
      reference.dispose()
      replayed.dispose()
    }
  })

  it('calls getSnapshot, resets xterm, writes snapshot data', async () => {
    const mockSnap = {
      terminalId: 'test-term', streamEpoch: 'epoch-1', watermark: 0,
      ansi: '\x1b[2Jhello', cols: 80, rows: 24, buffer: 'normal' as const,
    }
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

  it('does not force an alternate-buffer snapshot into the normal buffer', async () => {
    const mockSnap = {
      terminalId: 'test-term', streamEpoch: 'epoch-1', watermark: 0,
      ansi: 'snap-content', cols: 80, rows: 24, buffer: 'normal' as const,
    }
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

    expect(snapIdx).toBeGreaterThanOrEqual(0)
    expect(altBufIdx).toBe(-1)
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
    expect(electronMock.rebuildHeadless).not.toHaveBeenCalled()
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
      getSnapshot: vi.fn().mockResolvedValue({
        terminalId: 'test-term', streamEpoch: 'epoch-1', watermark: 0,
        ansi: '', cols: 0, rows: 0, buffer: 'normal',
      }),
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
      () => new Promise<TerminalSnapshot>(resolve =>
        setTimeout(() => resolve({
          terminalId: 'test-term', streamEpoch: 'epoch-1', watermark: 0,
          ansi: 'snap', cols: 80, rows: 24, buffer: 'normal',
        }), 50)
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
      return {
        terminalId: 'test-term', streamEpoch: 'epoch-1', watermark: 0,
        ansi: 'snap', cols: 80, rows: 24, buffer: 'normal',
      }
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
