// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useKeyboardShortcuts } from '../use-keyboard-shortcuts'
import type { PaneSplitDirection } from '@shared/types'

function dispatchSplit(target: EventTarget): boolean {
  const ev = new KeyboardEvent('keydown', {
    key: 'ArrowRight',
    code: 'ArrowRight',
    shiftKey: true,
    metaKey: true,
    bubbles: true,
    cancelable: true
  })
  Object.defineProperty(ev, 'target', { value: target, configurable: true })
  return window.dispatchEvent(ev)
}

describe('useKeyboardShortcuts — split-pane editable-target guard', () => {
  let onSplit: ReturnType<typeof vi.fn<(direction: PaneSplitDirection) => void>>
  let opts: Parameters<typeof useKeyboardShortcuts>[0]

  beforeEach(() => {
    onSplit = vi.fn<(direction: PaneSplitDirection) => void>()
    opts = {
      onAddTerminal: vi.fn(),
      onCloseTerminal: vi.fn(),
      onSplit
    }
  })

  afterEach(() => {
    document.body.innerHTML = ''
  })

  it('fires onSplit when target is a non-editable element (terminal pane)', () => {
    renderHook(() => useKeyboardShortcuts(opts))
    const target = document.createElement('div')
    document.body.appendChild(target)
    dispatchSplit(target)
    expect(onSplit).toHaveBeenCalledWith('right')
  })

  it('does NOT fire onSplit when target is an INPUT', () => {
    renderHook(() => useKeyboardShortcuts(opts))
    const input = document.createElement('input')
    document.body.appendChild(input)
    const ev = new KeyboardEvent('keydown', {
      key: 'ArrowRight',
      code: 'ArrowRight',
      shiftKey: true,
      metaKey: true,
      bubbles: true,
      cancelable: true
    })
    Object.defineProperty(ev, 'target', { value: input, configurable: true })
    window.dispatchEvent(ev)
    expect(onSplit).not.toHaveBeenCalled()
    expect(ev.defaultPrevented).toBe(false)
  })

  it('does NOT fire onSplit when target is a TEXTAREA', () => {
    renderHook(() => useKeyboardShortcuts(opts))
    const ta = document.createElement('textarea')
    document.body.appendChild(ta)
    const ev = new KeyboardEvent('keydown', {
      key: 'ArrowRight',
      code: 'ArrowRight',
      shiftKey: true,
      metaKey: true,
      bubbles: true,
      cancelable: true
    })
    Object.defineProperty(ev, 'target', { value: ta, configurable: true })
    window.dispatchEvent(ev)
    expect(onSplit).not.toHaveBeenCalled()
    expect(ev.defaultPrevented).toBe(false)
  })

  it('does NOT fire onSplit when target is contentEditable', () => {
    renderHook(() => useKeyboardShortcuts(opts))
    const div = document.createElement('div')
    // jsdom's `contentEditable` setter doesn't always reflect into the
    // attribute, so set both for portability.
    div.setAttribute('contenteditable', 'true')
    document.body.appendChild(div)
    const ev = new KeyboardEvent('keydown', {
      key: 'ArrowRight',
      code: 'ArrowRight',
      shiftKey: true,
      metaKey: true,
      bubbles: true,
      cancelable: true
    })
    Object.defineProperty(ev, 'target', { value: div, configurable: true })
    window.dispatchEvent(ev)
    expect(onSplit).not.toHaveBeenCalled()
  })

  it('still fires non-split shortcuts when target is INPUT (e.g. new-terminal)', () => {
    const onAddTerminal = vi.fn()
    renderHook(() =>
      useKeyboardShortcuts({
        onAddTerminal,
        onCloseTerminal: vi.fn(),
        onSplit
      })
    )
    const input = document.createElement('input')
    document.body.appendChild(input)
    const ev = new KeyboardEvent('keydown', {
      key: 't',
      code: 'KeyT',
      ctrlKey: true,
      bubbles: true,
      cancelable: true
    })
    Object.defineProperty(ev, 'target', { value: input, configurable: true })
    window.dispatchEvent(ev)
    // onAddTerminal should still fire because guard only targets split-pane.
    expect(onAddTerminal).toHaveBeenCalledWith({ layout: 'balanced' })
  })

  it('Ctrl+N routes new-terminal with vertical layout', () => {
    const onAddTerminal = vi.fn()
    renderHook(() =>
      useKeyboardShortcuts({
        onAddTerminal,
        onCloseTerminal: vi.fn(),
        onSplit
      })
    )
    const target = document.createElement('div')
    document.body.appendChild(target)
    const ev = new KeyboardEvent('keydown', {
      key: 'n',
      code: 'KeyN',
      ctrlKey: true,
      bubbles: true,
      cancelable: true
    })
    Object.defineProperty(ev, 'target', { value: target, configurable: true })
    window.dispatchEvent(ev)
    expect(onAddTerminal).toHaveBeenCalledWith({ layout: 'vertical' })
  })
})
