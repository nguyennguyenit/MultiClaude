// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { usePaneResize } from '../use-pane-resize'

interface FakePointerDown {
  pointerId: number
  clientX: number
  clientY: number
  currentTarget: HTMLElement
}

function fakePointerDown(
  target: HTMLElement,
  clientX: number,
  clientY: number,
  pointerId = 1
): FakePointerDown {
  return { pointerId, clientX, clientY, currentTarget: target }
}

function dispatchMoveRaw(
  target: HTMLElement,
  clientX: number,
  clientY: number,
  pointerId = 1
): void {
  const ev = new Event('pointermove', { bubbles: true }) as PointerEvent & { clientX: number; clientY: number; pointerId: number }
  Object.defineProperty(ev, 'clientX', { value: clientX })
  Object.defineProperty(ev, 'clientY', { value: clientY })
  Object.defineProperty(ev, 'pointerId', { value: pointerId })
  target.dispatchEvent(ev)
}

function dispatchUp(target: HTMLElement, pointerId = 1): void {
  const ev = new Event('pointerup', { bubbles: true }) as PointerEvent & { pointerId: number }
  Object.defineProperty(ev, 'pointerId', { value: pointerId })
  target.dispatchEvent(ev)
}

function dispatchCancel(target: HTMLElement, pointerId = 1): void {
  const ev = new Event('pointercancel', { bubbles: true }) as PointerEvent & { pointerId: number }
  Object.defineProperty(ev, 'pointerId', { value: pointerId })
  target.dispatchEvent(ev)
}

describe('usePaneResize', () => {
  let setRatio: ReturnType<typeof vi.fn<(ratio: number) => void>>
  let container: HTMLDivElement
  let handle: HTMLDivElement
  let rafQueue: FrameRequestCallback[] = []

  // Impl rAF-coalesces ratio updates (see use-pane-resize.ts). Queue
  // callbacks and flush after each dispatch so we observe the value without
  // racing impl's `scheduledFrame = rAF(...)` assignment — a purely sync
  // stub would leave scheduledFrame non-null and wedge subsequent moves.
  function flushRaf(): void {
    const pending = rafQueue
    rafQueue = []
    pending.forEach(cb => cb(performance.now()))
  }

  beforeEach(() => {
    rafQueue = []
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
      rafQueue.push(cb)
      return rafQueue.length
    })
    vi.stubGlobal('cancelAnimationFrame', () => {})
    setRatio = vi.fn<(ratio: number) => void>()
    container = document.createElement('div')
    handle = document.createElement('div')
    Object.defineProperty(container, 'getBoundingClientRect', {
      value: () => ({ width: 200, height: 100, top: 0, left: 0, right: 200, bottom: 100, x: 0, y: 0, toJSON: () => ({}) }),
      configurable: true,
      writable: true
    })
    // jsdom doesn't implement pointer capture — stub to record calls.
    handle.setPointerCapture = vi.fn()
    handle.releasePointerCapture = vi.fn()
    document.body.appendChild(container)
    document.body.appendChild(handle)
  })

  function dispatchMove(
    target: HTMLElement,
    clientX: number,
    clientY: number,
    pointerId = 1
  ): void {
    dispatchMoveRaw(target, clientX, clientY, pointerId)
    flushRaf()
  }

  function mount(orientation: 'row' | 'column', startRatio = 0.5, minPanePx = 10) {
    // Default minPanePx is low so tests focused on the raw-ratio math keep
    // exercising PANE_RATIO_MIN/MAX semantics. Tests verifying the pixel-min
    // clamp pass a larger value explicitly.
    return renderHook(() =>
      usePaneResize({
        orientation,
        startRatio,
        containerRef: { current: container },
        onRatioChange: setRatio,
        minPanePx
      })
    )
  }

  it('row: drag right increases the ratio', () => {
    const { result } = mount('row', 0.5)
    act(() => result.current.beginDrag(fakePointerDown(handle, 100, 0)))
    act(() => dispatchMove(handle, 140, 0))
    expect(setRatio).toHaveBeenLastCalledWith(0.7)
  })

  it('row: drag left decreases the ratio', () => {
    const { result } = mount('row', 0.5)
    act(() => result.current.beginDrag(fakePointerDown(handle, 100, 0)))
    act(() => dispatchMove(handle, 80, 0))
    expect(setRatio).toHaveBeenLastCalledWith(0.4)
  })

  it('column: drag down increases the ratio', () => {
    const { result } = mount('column', 0.3)
    act(() => result.current.beginDrag(fakePointerDown(handle, 0, 20)))
    act(() => dispatchMove(handle, 0, 40))
    expect(setRatio).toHaveBeenLastCalledWith(0.5)
  })

  it('clamps ratio into [0.1, 0.9]', () => {
    const { result } = mount('row', 0.5)
    act(() => result.current.beginDrag(fakePointerDown(handle, 100, 0)))
    act(() => dispatchMove(handle, 500, 0))
    expect(setRatio).toHaveBeenLastCalledWith(0.9)
  })

  it('pointerup stops receiving move events', () => {
    const { result } = mount('row', 0.5)
    act(() => result.current.beginDrag(fakePointerDown(handle, 100, 0)))
    act(() => dispatchUp(handle))
    setRatio.mockClear()
    act(() => dispatchMove(handle, 180, 0))
    expect(setRatio).not.toHaveBeenCalled()
  })

  it('pointercancel stops receiving move events', () => {
    const { result } = mount('row', 0.5)
    act(() => result.current.beginDrag(fakePointerDown(handle, 100, 0)))
    act(() => dispatchCancel(handle))
    setRatio.mockClear()
    act(() => dispatchMove(handle, 180, 0))
    expect(setRatio).not.toHaveBeenCalled()
  })

  it('captures the pointer on currentTarget for reliable tracking', () => {
    const { result } = mount('row', 0.5)
    act(() => result.current.beginDrag(fakePointerDown(handle, 100, 0, 42)))
    expect(handle.setPointerCapture).toHaveBeenCalledWith(42)
  })

  it('re-reads container rect on each move (window resize mid-drag)', () => {
    // Start with width=200; after beginDrag, shrink the container to 100.
    // Delta=20 → with cached size(200) would give 0.6; with fresh size(100) gives 0.7.
    let width = 200
    Object.defineProperty(container, 'getBoundingClientRect', {
      value: () => ({ width, height: 100, top: 0, left: 0, right: width, bottom: 100, x: 0, y: 0, toJSON: () => ({}) }),
      configurable: true,
      writable: true
    })
    const { result } = mount('row', 0.5)
    act(() => result.current.beginDrag(fakePointerDown(handle, 100, 0)))
    width = 100
    act(() => dispatchMove(handle, 120, 0))
    expect(setRatio).toHaveBeenLastCalledWith(0.7)
  })

  it('enforces absolute minimum pane pixel size beyond ratio clamp', () => {
    // container width = 200, minPanePx = 80 → each pane must be ≥ 80 px.
    // That bounds ratio to [0.4, 0.6] — tighter than the PANE_RATIO_MIN 0.1.
    const { result } = mount('row', 0.5, 80)
    act(() => result.current.beginDrag(fakePointerDown(handle, 100, 0)))
    act(() => dispatchMove(handle, 0, 0))
    expect(setRatio).toHaveBeenLastCalledWith(0.4)
    act(() => dispatchMove(handle, 300, 0))
    expect(setRatio).toHaveBeenLastCalledWith(0.6)
  })

  it('unmount mid-drag cleans up listeners (no onRatioChange after unmount)', () => {
    const { result, unmount } = mount('row', 0.5)
    act(() => result.current.beginDrag(fakePointerDown(handle, 100, 0)))
    unmount()
    setRatio.mockClear()
    // Subsequent move on the handle should not reach a stale onRatioChange.
    act(() => dispatchMove(handle, 140, 0))
    expect(setRatio).not.toHaveBeenCalled()
  })
})
