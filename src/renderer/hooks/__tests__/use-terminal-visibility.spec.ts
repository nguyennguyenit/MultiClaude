// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Terminal as XTerm } from '@xterm/xterm'
import { TerminalScrollMachine } from '../../utils/terminal-scroll-machine'
import { useTerminalVisibility } from '../use-terminal-visibility'

function createHarness(isActive: boolean) {
  const terminal = {
    buffer: { active: { baseY: 40, viewportY: 10 } },
    focus: vi.fn(),
    options: { smoothScrollDuration: 0 },
    scrollToBottom: vi.fn(),
    scrollToLine: vi.fn(),
  } as unknown as XTerm
  const scrollMachine = new TerminalScrollMachine()

  return {
    terminal,
    props: {
      terminalRef: { current: terminal },
      disposedRef: { current: false },
      isActive,
      isHidden: false,
      prevHiddenRef: { current: false },
      webglLoadingRef: { current: false },
      scrollMachineRef: { current: scrollMachine },
      reconcileWebGL: vi.fn(),
      performFit: vi.fn(() => true),
      refreshVisibleRows: vi.fn(),
    },
  }
}

describe('useTerminalVisibility', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) =>
      setTimeout(() => callback(0), 0) as unknown as number)
    vi.stubGlobal('cancelAnimationFrame', (handle: number) =>
      clearTimeout(handle as unknown as ReturnType<typeof setTimeout>))
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.useRealTimers()
  })

  it('repaints an active pane once after its project becomes visible', async () => {
    const { terminal, props } = createHarness(true)
    const hook = renderHook(
      (nextProps: typeof props) => useTerminalVisibility(nextProps),
      { initialProps: props },
    )

    hook.rerender({ ...props, isHidden: true })
    hook.rerender({ ...props, isHidden: false })

    await act(async () => { await vi.advanceTimersByTimeAsync(2_000) })

    expect(props.performFit).toHaveBeenCalledTimes(1)
    expect(props.performFit).toHaveBeenCalledWith(false)
    expect(props.refreshVisibleRows).not.toHaveBeenCalled()
    expect(terminal.scrollToLine).toHaveBeenCalledWith(10)
    expect(terminal.focus).toHaveBeenCalledTimes(1)
  })

  it('repaints an inactive sibling without stealing focus', async () => {
    const { terminal, props } = createHarness(false)
    const hook = renderHook(
      (nextProps: typeof props) => useTerminalVisibility(nextProps),
      { initialProps: props },
    )

    hook.rerender({ ...props, isHidden: true })
    hook.rerender({ ...props, isHidden: false })

    await act(async () => { await vi.advanceTimersByTimeAsync(2_000) })

    expect(props.performFit).toHaveBeenCalledTimes(1)
    expect(terminal.scrollToLine).toHaveBeenCalledWith(10)
    expect(terminal.focus).not.toHaveBeenCalled()
  })

  it('waits for WebGL readiness but still performs only one repaint', async () => {
    const { props } = createHarness(true)
    props.reconcileWebGL.mockImplementation(() => {
      props.webglLoadingRef.current = true
    })
    const hook = renderHook(
      (nextProps: typeof props) => useTerminalVisibility(nextProps),
      { initialProps: props },
    )

    hook.rerender({ ...props, isHidden: true })
    hook.rerender({ ...props, isHidden: false })

    await act(async () => { await vi.advanceTimersByTimeAsync(60) })
    expect(props.reconcileWebGL).toHaveBeenCalledTimes(1)
    expect(props.performFit).not.toHaveBeenCalled()

    props.webglLoadingRef.current = false
    await act(async () => { await vi.advanceTimersByTimeAsync(2_000) })

    expect(props.performFit).toHaveBeenCalledTimes(1)
  })

  it('keeps a pending reveal repaint when the active pane changes', async () => {
    const { terminal, props } = createHarness(true)
    const hook = renderHook(
      (nextProps: typeof props) => useTerminalVisibility(nextProps),
      { initialProps: props },
    )

    hook.rerender({ ...props, isHidden: true })
    props.webglLoadingRef.current = true
    hook.rerender({ ...props, isHidden: false })

    await act(async () => { await vi.advanceTimersByTimeAsync(60) })
    hook.rerender({ ...props, isActive: false, isHidden: false })
    props.webglLoadingRef.current = false
    await act(async () => { await vi.advanceTimersByTimeAsync(2_000) })

    expect(props.performFit).toHaveBeenCalledTimes(1)
    expect(terminal.scrollToLine).toHaveBeenCalledWith(10)
    expect(terminal.focus).not.toHaveBeenCalled()
  })

  it('refreshes visible rows once when fitting is unavailable', async () => {
    const { props } = createHarness(true)
    props.performFit.mockReturnValue(false)
    const hook = renderHook(
      (nextProps: typeof props) => useTerminalVisibility(nextProps),
      { initialProps: props },
    )

    hook.rerender({ ...props, isHidden: true })
    hook.rerender({ ...props, isHidden: false })

    await act(async () => { await vi.advanceTimersByTimeAsync(2_000) })

    expect(props.performFit).toHaveBeenCalledTimes(1)
    expect(props.refreshVisibleRows).toHaveBeenCalledTimes(1)
  })
})
