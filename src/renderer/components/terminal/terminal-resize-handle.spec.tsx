// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import { render, fireEvent } from '@testing-library/react'
import { ResizeHandle } from './terminal-resize-handle'

describe('<ResizeHandle>', () => {
  it('is keyboard-focusable as a separator with correct aria', () => {
    const onResizeStart = vi.fn()
    const onAdjust = vi.fn()
    const { container } = render(
      <ResizeHandle
        direction="vertical"
        onResizeStart={onResizeStart}
        currentRatio={0.5}
        onAdjust={onAdjust}
      />
    )
    const el = container.querySelector('.terminal-resize-handle') as HTMLElement
    expect(el.getAttribute('role')).toBe('separator')
    expect(el.getAttribute('tabindex')).toBe('0')
    expect(el.getAttribute('aria-orientation')).toBe('vertical')
    expect(el.getAttribute('aria-valuenow')).toBe('0.5')
  })

  it('horizontal handle reports aria-orientation horizontal', () => {
    const { container } = render(
      <ResizeHandle
        direction="horizontal"
        onResizeStart={vi.fn()}
        currentRatio={0.3}
        onAdjust={vi.fn()}
      />
    )
    const el = container.querySelector('.terminal-resize-handle') as HTMLElement
    expect(el.getAttribute('aria-orientation')).toBe('horizontal')
  })

  it('ArrowRight on vertical handle increases ratio by 5%', () => {
    const onAdjust = vi.fn()
    const { container } = render(
      <ResizeHandle
        direction="vertical"
        onResizeStart={vi.fn()}
        currentRatio={0.5}
        onAdjust={onAdjust}
      />
    )
    const el = container.querySelector('.terminal-resize-handle') as HTMLElement
    fireEvent.keyDown(el, { key: 'ArrowRight' })
    expect(onAdjust).toHaveBeenCalledWith(expect.closeTo(0.55, 5))
  })

  it('ArrowLeft on vertical handle decreases ratio by 5%', () => {
    const onAdjust = vi.fn()
    const { container } = render(
      <ResizeHandle
        direction="vertical"
        onResizeStart={vi.fn()}
        currentRatio={0.5}
        onAdjust={onAdjust}
      />
    )
    const el = container.querySelector('.terminal-resize-handle') as HTMLElement
    fireEvent.keyDown(el, { key: 'ArrowLeft' })
    expect(onAdjust).toHaveBeenCalledWith(expect.closeTo(0.45, 5))
  })

  it('Shift+Arrow uses a 1% fine-grained step', () => {
    const onAdjust = vi.fn()
    const { container } = render(
      <ResizeHandle
        direction="vertical"
        onResizeStart={vi.fn()}
        currentRatio={0.5}
        onAdjust={onAdjust}
      />
    )
    const el = container.querySelector('.terminal-resize-handle') as HTMLElement
    fireEvent.keyDown(el, { key: 'ArrowRight', shiftKey: true })
    expect(onAdjust).toHaveBeenCalledWith(expect.closeTo(0.51, 5))
  })

  it('ArrowDown on horizontal handle increases ratio', () => {
    const onAdjust = vi.fn()
    const { container } = render(
      <ResizeHandle
        direction="horizontal"
        onResizeStart={vi.fn()}
        currentRatio={0.5}
        onAdjust={onAdjust}
      />
    )
    const el = container.querySelector('.terminal-resize-handle') as HTMLElement
    fireEvent.keyDown(el, { key: 'ArrowDown' })
    expect(onAdjust).toHaveBeenCalledWith(expect.closeTo(0.55, 5))
  })

  it('non-arrow keys do not fire onAdjust', () => {
    const onAdjust = vi.fn()
    const { container } = render(
      <ResizeHandle
        direction="vertical"
        onResizeStart={vi.fn()}
        currentRatio={0.5}
        onAdjust={onAdjust}
      />
    )
    const el = container.querySelector('.terminal-resize-handle') as HTMLElement
    fireEvent.keyDown(el, { key: 'Enter' })
    fireEvent.keyDown(el, { key: 'a' })
    expect(onAdjust).not.toHaveBeenCalled()
  })
})
