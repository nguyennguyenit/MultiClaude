// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, fireEvent, screen, act } from '@testing-library/react'
import { ThemedContextMenu } from './themed-context-menu'
import { useContextMenuStore } from '../../stores/context-menu-store'

import type { ContextMenuItem } from '../../stores/context-menu-store'

function openMenu(items: ContextMenuItem[], x = 10, y = 10) {
  act(() => {
    useContextMenuStore.getState().openMenu({ x, y, items })
  })
}

describe('ThemedContextMenu', () => {
  beforeEach(() => {
    useContextMenuStore.getState().closeMenu()
  })

  it('renders nothing when closed', () => {
    const { container } = render(<ThemedContextMenu />)
    expect(container.querySelector('[role="menu"]')).toBeNull()
  })

  it('renders menu items when open', () => {
    render(<ThemedContextMenu />)
    openMenu([
      { id: 'copy', label: 'Copy' },
      { id: 'paste', label: 'Paste' }
    ])
    expect(screen.getByText('Copy')).toBeTruthy()
    expect(screen.getByText('Paste')).toBeTruthy()
  })

  it('renders separator as hr', () => {
    render(<ThemedContextMenu />)
    openMenu([
      { id: 'a', label: 'A' },
      { id: 'sep', label: '', separator: true },
      { id: 'b', label: 'B' }
    ])
    expect(document.querySelector('hr')).toBeTruthy()
  })

  it('click outside closes menu', () => {
    render(<ThemedContextMenu />)
    openMenu([{ id: 'a', label: 'A' }])
    act(() => {
      fireEvent.mouseDown(document.body)
    })
    expect(useContextMenuStore.getState().open).toBe(false)
  })

  it('Escape closes menu', () => {
    render(<ThemedContextMenu />)
    openMenu([{ id: 'a', label: 'A' }])
    act(() => {
      fireEvent.keyDown(window, { key: 'Escape' })
    })
    expect(useContextMenuStore.getState().open).toBe(false)
  })

  it('Enter activates focused item and closes', () => {
    const onSelect = vi.fn()
    render(<ThemedContextMenu />)
    openMenu([{ id: 'a', label: 'A', onSelect }])
    act(() => {
      fireEvent.keyDown(window, { key: 'Enter' })
    })
    expect(onSelect).toHaveBeenCalled()
    expect(useContextMenuStore.getState().open).toBe(false)
  })

  it('ArrowDown moves focus to next item, wraps at end', () => {
    render(<ThemedContextMenu />)
    const onSelect2 = vi.fn()
    openMenu([
      { id: 'a', label: 'A' },
      { id: 'b', label: 'B', onSelect: onSelect2 }
    ])
    act(() => {
      fireEvent.keyDown(window, { key: 'ArrowDown' })
      fireEvent.keyDown(window, { key: 'Enter' })
    })
    expect(onSelect2).toHaveBeenCalled()
  })

  it('ArrowUp moves focus to previous item, wraps from 0', () => {
    const onSelectB = vi.fn()
    render(<ThemedContextMenu />)
    openMenu([
      { id: 'a', label: 'A' },
      { id: 'b', label: 'B', onSelect: onSelectB }
    ])
    act(() => {
      fireEvent.keyDown(window, { key: 'ArrowUp' })
      fireEvent.keyDown(window, { key: 'Enter' })
    })
    expect(onSelectB).toHaveBeenCalled()
  })

  it('disabled item is not activated by click', () => {
    const onSelect = vi.fn()
    render(<ThemedContextMenu />)
    openMenu([{ id: 'a', label: 'A', disabled: true, onSelect }])
    act(() => {
      fireEvent.click(screen.getByText('A'))
    })
    expect(onSelect).not.toHaveBeenCalled()
  })

  it('click on item calls onSelect and closes', () => {
    const onSelect = vi.fn()
    render(<ThemedContextMenu />)
    openMenu([{ id: 'a', label: 'Item A', onSelect }])
    act(() => {
      fireEvent.click(screen.getByText('Item A'))
    })
    expect(onSelect).toHaveBeenCalled()
    expect(useContextMenuStore.getState().open).toBe(false)
  })

  it('shortcut label renders when provided', () => {
    render(<ThemedContextMenu />)
    openMenu([{ id: 'a', label: 'Split right', shortcut: '⌘⇧→' }])
    expect(screen.getByText('⌘⇧→')).toBeTruthy()
  })

  it('restores focus to the element focused before menu opened', () => {
    const trigger = document.createElement('button')
    trigger.textContent = 'trigger'
    document.body.appendChild(trigger)
    trigger.focus()
    expect(document.activeElement).toBe(trigger)

    render(<ThemedContextMenu />)
    openMenu([{ id: 'a', label: 'A' }])
    // Simulate focus shifting into the menu (e.g. keyboard nav landed on an item).
    const menuItem = document.querySelector('.themed-context-menu-item') as HTMLButtonElement
    menuItem.focus()
    expect(document.activeElement).not.toBe(trigger)

    act(() => {
      useContextMenuStore.getState().closeMenu()
    })

    expect(document.activeElement).toBe(trigger)
    trigger.remove()
  })

  it('position clamped to viewport right edge', () => {
    Object.defineProperty(window, 'innerWidth', { value: 800, writable: true, configurable: true })
    Object.defineProperty(window, 'innerHeight', { value: 600, writable: true, configurable: true })

    render(<ThemedContextMenu />)
    openMenu([{ id: 'a', label: 'A' }], 790, 10)

    const menu = document.querySelector('[role="menu"]') as HTMLElement | null
    expect(menu).toBeTruthy()
    const left = parseInt(menu!.style.left, 10)
    expect(left).toBeLessThanOrEqual(800)
    expect(left).toBeGreaterThanOrEqual(0)
  })
})
