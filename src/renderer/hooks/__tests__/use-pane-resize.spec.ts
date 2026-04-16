// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { usePaneResize } from '../use-pane-resize'

describe('usePaneResize', () => {
  let setRatio: ReturnType<typeof vi.fn<(ratio: number) => void>>
  let container: HTMLDivElement

  beforeEach(() => {
    setRatio = vi.fn<(ratio: number) => void>()
    container = document.createElement('div')
    Object.defineProperty(container, 'getBoundingClientRect', {
      value: () => ({ width: 200, height: 100, top: 0, left: 0, right: 200, bottom: 100, x: 0, y: 0, toJSON: () => ({}) }),
      configurable: true
    })
    document.body.appendChild(container)
  })

  function mount(orientation: 'row' | 'column', startRatio = 0.5) {
    return renderHook(() =>
      usePaneResize({
        orientation,
        startRatio,
        containerRef: { current: container },
        onRatioChange: setRatio
      })
    )
  }

  it('row: drag right increases the ratio', () => {
    const { result } = mount('row', 0.5)
    act(() => result.current.beginDrag(100))
    act(() => window.dispatchEvent(new PointerEvent('pointermove', { clientX: 140, clientY: 0 })))
    // delta=40, width=200, newRatio = 0.5 + 40/200 = 0.7
    expect(setRatio).toHaveBeenLastCalledWith(0.7)
  })

  it('row: drag left decreases the ratio', () => {
    const { result } = mount('row', 0.5)
    act(() => result.current.beginDrag(100))
    act(() => window.dispatchEvent(new PointerEvent('pointermove', { clientX: 80, clientY: 0 })))
    expect(setRatio).toHaveBeenLastCalledWith(0.4)
  })

  it('column: drag down increases the ratio', () => {
    const { result } = mount('column', 0.3)
    act(() => result.current.beginDrag(20))
    act(() => window.dispatchEvent(new PointerEvent('pointermove', { clientX: 0, clientY: 40 })))
    // delta=20, height=100, newRatio = 0.3 + 20/100 = 0.5
    expect(setRatio).toHaveBeenLastCalledWith(0.5)
  })

  it('clamps ratio into [0.1, 0.9]', () => {
    const { result } = mount('row', 0.5)
    act(() => result.current.beginDrag(100))
    act(() => window.dispatchEvent(new PointerEvent('pointermove', { clientX: 500, clientY: 0 })))
    expect(setRatio).toHaveBeenLastCalledWith(0.9)
  })

  it('pointerup stops receiving move events', () => {
    const { result } = mount('row', 0.5)
    act(() => result.current.beginDrag(100))
    act(() => window.dispatchEvent(new PointerEvent('pointerup')))
    setRatio.mockClear()
    act(() => window.dispatchEvent(new PointerEvent('pointermove', { clientX: 180, clientY: 0 })))
    expect(setRatio).not.toHaveBeenCalled()
  })
})
