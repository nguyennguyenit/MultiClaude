// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import { MIN_SAFE_COLS, useTerminalFit, type ResizeColsChange } from '../use-terminal-fit'
import { setPaneDragging } from '../../utils/pane-drag-state'
import { resetResizeEndDispatcherForTests, suppressAutoResizeRefresh } from '../../utils/terminal-resize-end-dispatcher'
import { DEFAULT_SETTINGS } from '@shared/constants'
import { useSettingsStore } from '../../stores'

function makeTerminal(cols = 80, rows = 24, bufferType: 'normal' | 'alternate' = 'normal') {
  return {
    cols,
    rows,
    buffer: { active: { type: bufferType, viewportY: 0, baseY: 0 } },
    resize: vi.fn(function (this: { cols: number; rows: number }, nextCols: number, nextRows: number) {
      this.cols = nextCols
      this.rows = nextRows
    }),
    scrollToBottom: vi.fn(),
    scrollToLine: vi.fn(),
  }
}

function renderUseTerminalFit(
  proposed: { cols: number; rows: number },
  onResizeEnd?: (source: 'pane-drag' | 'window', colsChanged: ResizeColsChange) => void,
  onColsChanged?: () => void,
  options: { initialCols?: number; initialRows?: number; bufferType?: 'normal' | 'alternate' } = {}
) {
  const terminal = makeTerminal(options.initialCols, options.initialRows, options.bufferType)
  const fitAddon = {
    fit: vi.fn(() => {
      terminal.cols = proposed.cols
      terminal.rows = proposed.rows
    }),
    proposeDimensions: vi.fn(() => proposed),
  }
  const refreshVisibleRows = vi.fn()

  const hook = renderHook(() =>
    useTerminalFit({
      terminalId: 'test-term',
      terminalRef: { current: terminal } as never,
      fitAddonRef: { current: fitAddon } as never,
      containerRef: {
        current: { clientWidth: 160, clientHeight: 240 },
      } as never,
      disposedRef: { current: false },
      scrollMachineRef: { current: { isAtBottom: true } } as never,
      refreshVisibleRows,
      onColsChanged,
      onResizeEnd,
    })
  )

  return { ...hook, terminal, fitAddon, refreshVisibleRows }
}

describe('useTerminalFit', () => {
  beforeEach(() => {
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
      cb(performance.now())
      return 1
    })
    vi.stubGlobal('cancelAnimationFrame', vi.fn())
    resetResizeEndDispatcherForTests()
    useSettingsStore.setState({
      savedSettings: { ...DEFAULT_SETTINGS, reflowSafeScrollback: false },
      pendingSettings: { ...DEFAULT_SETTINGS, reflowSafeScrollback: false },
      settings: { ...DEFAULT_SETTINGS, reflowSafeScrollback: false },
    })
  })

  afterEach(() => {
    setPaneDragging(false)
    resetResizeEndDispatcherForTests()
    vi.unstubAllGlobals()
    vi.useRealTimers()
  })

  it('fits normally when proposed cols are safe', () => {
    const { result, terminal, fitAddon } = renderUseTerminalFit({ cols: 40, rows: 20 })

    expect(result.current.performFit()).toBe(true)

    expect(fitAddon.fit).toHaveBeenCalledTimes(1)
    expect(terminal.resize).not.toHaveBeenCalled()
    expect(terminal.cols).toBe(40)
    expect(terminal.rows).toBe(20)
  })

  it('clamps very narrow panes to the minimum safe cols', () => {
    const { result, terminal, fitAddon } = renderUseTerminalFit({ cols: 12, rows: 20 })

    expect(result.current.performFit()).toBe(true)

    expect(fitAddon.fit).not.toHaveBeenCalled()
    expect(terminal.resize).toHaveBeenCalledWith(MIN_SAFE_COLS, 20)
    expect(terminal.cols).toBe(MIN_SAFE_COLS)
    expect(terminal.rows).toBe(20)
  })

  it('clamps very narrow alt-screen panes to the minimum safe cols', () => {
    const { result, terminal, fitAddon } = renderUseTerminalFit(
      { cols: 12, rows: 20 },
      undefined,
      undefined,
      { bufferType: 'alternate' }
    )

    expect(result.current.performFit()).toBe(true)

    expect(fitAddon.fit).not.toHaveBeenCalled()
    expect(terminal.resize).toHaveBeenCalledWith(MIN_SAFE_COLS, 20)
    expect(terminal.cols).toBe(MIN_SAFE_COLS)
    expect(terminal.rows).toBe(20)
  })

  it('reports pane-drag resize-end after responsive normal-buffer shrink', () => {
    vi.useFakeTimers()
    const onResizeEnd = vi.fn()
    const proposed = { cols: 80, rows: 20 }
    const { result, terminal } = renderUseTerminalFit(proposed, onResizeEnd)

    expect(result.current.performFit()).toBe(true)
    proposed.cols = 40

    act(() => setPaneDragging(true))
    act(() => result.current.fit())
    act(() => vi.advanceTimersByTime(16))
    expect(terminal.cols).toBe(40)
    act(() => setPaneDragging(false))
    act(() => vi.advanceTimersByTime(350))

    expect(terminal.cols).toBe(40)
    expect(onResizeEnd).toHaveBeenCalledWith('pane-drag', { changed: true, direction: 'narrower' })
  })

  it('keeps pane-drag resize-end open for a late post-drag shrink fit', () => {
    vi.useFakeTimers()
    const onResizeEnd = vi.fn()
    const proposed = { cols: 80, rows: 20 }
    const { result, terminal } = renderUseTerminalFit(proposed, onResizeEnd)

    expect(result.current.performFit()).toBe(true)

    act(() => setPaneDragging(true))
    act(() => result.current.fit())
    act(() => setPaneDragging(false))
    act(() => vi.advanceTimersByTime(100))

    proposed.cols = 44
    act(() => result.current.fit())
    act(() => vi.advanceTimersByTime(400))
    expect(terminal.cols).toBe(44)
    expect(onResizeEnd).toHaveBeenCalledWith('pane-drag', { changed: true, direction: 'narrower' })
  })

  it('reports pane-drag resize-end as wider when final cols grow', () => {
    vi.useFakeTimers()
    const onResizeEnd = vi.fn()
    const proposed = { cols: 40, rows: 20 }
    const { result } = renderUseTerminalFit(
      proposed,
      onResizeEnd,
      undefined,
      { initialCols: 40 }
    )

    expect(result.current.performFit()).toBe(true)
    proposed.cols = 80

    act(() => setPaneDragging(true))
    act(() => result.current.fit())
    act(() => setPaneDragging(false))
    act(() => vi.advanceTimersByTime(350))

    expect(onResizeEnd).toHaveBeenCalledWith('pane-drag', { changed: true, direction: 'wider' })
  })

  it('does not auto-rebuild scrollback for split-triggered column changes', () => {
    vi.useFakeTimers()
    useSettingsStore.setState({
      savedSettings: { ...DEFAULT_SETTINGS, reflowSafeScrollback: true },
      pendingSettings: { ...DEFAULT_SETTINGS, reflowSafeScrollback: true },
      settings: { ...DEFAULT_SETTINGS, reflowSafeScrollback: true },
    })

    const onColsChanged = vi.fn()
    const proposed = { cols: 80, rows: 20 }
    const { result } = renderUseTerminalFit(proposed, undefined, onColsChanged)

    expect(result.current.performFit()).toBe(true)

    suppressAutoResizeRefresh('test-term')
    proposed.cols = 40
    expect(result.current.performFit()).toBe(true)
    act(() => vi.advanceTimersByTime(400))

    expect(onColsChanged).not.toHaveBeenCalled()
  })

  it('does not auto-rebuild scrollback while a pane-drag shrink settles', () => {
    vi.useFakeTimers()
    useSettingsStore.setState({
      savedSettings: { ...DEFAULT_SETTINGS, reflowSafeScrollback: true },
      pendingSettings: { ...DEFAULT_SETTINGS, reflowSafeScrollback: true },
      settings: { ...DEFAULT_SETTINGS, reflowSafeScrollback: true },
    })

    const onColsChanged = vi.fn()
    const proposed = { cols: 80, rows: 20 }
    const { result } = renderUseTerminalFit(proposed, undefined, onColsChanged)

    expect(result.current.performFit()).toBe(true)
    proposed.cols = 40

    act(() => setPaneDragging(true))
    act(() => result.current.fit())
    expect(result.current.performFit()).toBe(true)
    act(() => setPaneDragging(false))
    act(() => vi.advanceTimersByTime(400))

    expect(onColsChanged).not.toHaveBeenCalled()
  })

  it('does not auto-rebuild scrollback while a pane-drag widen settles', () => {
    vi.useFakeTimers()
    useSettingsStore.setState({
      savedSettings: { ...DEFAULT_SETTINGS, reflowSafeScrollback: true },
      pendingSettings: { ...DEFAULT_SETTINGS, reflowSafeScrollback: true },
      settings: { ...DEFAULT_SETTINGS, reflowSafeScrollback: true },
    })

    const onColsChanged = vi.fn()
    const onResizeEnd = vi.fn()
    const proposed = { cols: 40, rows: 20 }
    const { result } = renderUseTerminalFit(
      proposed,
      onResizeEnd,
      onColsChanged,
      { initialCols: 40 }
    )

    expect(result.current.performFit()).toBe(true)
    proposed.cols = 80

    act(() => setPaneDragging(true))
    act(() => result.current.fit())
    act(() => setPaneDragging(false))
    act(() => vi.advanceTimersByTime(400))

    expect(onResizeEnd).toHaveBeenCalledWith('pane-drag', { changed: true, direction: 'wider' })
    expect(onColsChanged).not.toHaveBeenCalled()
  })
})
