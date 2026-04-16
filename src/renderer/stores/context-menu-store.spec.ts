import { describe, it, expect, beforeEach } from 'vitest'
import { useContextMenuStore } from './context-menu-store'

describe('useContextMenuStore', () => {
  beforeEach(() => {
    useContextMenuStore.getState().closeMenu()
  })

  it('initial state is closed', () => {
    const { open, items } = useContextMenuStore.getState()
    expect(open).toBe(false)
    expect(items).toEqual([])
  })

  it('openMenu sets open=true with payload', () => {
    useContextMenuStore.getState().openMenu({
      x: 100,
      y: 200,
      items: [{ id: 'copy', label: 'Copy', onSelect: () => {} }]
    })
    const state = useContextMenuStore.getState()
    expect(state.open).toBe(true)
    expect(state.x).toBe(100)
    expect(state.y).toBe(200)
    expect(state.items).toHaveLength(1)
    expect(state.items[0].id).toBe('copy')
  })

  it('closeMenu resets state', () => {
    useContextMenuStore.getState().openMenu({
      x: 10,
      y: 10,
      items: [{ id: 'a', label: 'A' }]
    })
    useContextMenuStore.getState().closeMenu()
    const state = useContextMenuStore.getState()
    expect(state.open).toBe(false)
    expect(state.items).toEqual([])
  })

  it('openMenu while already open replaces state (no stacking)', () => {
    useContextMenuStore.getState().openMenu({
      x: 0,
      y: 0,
      items: [{ id: 'a', label: 'A' }]
    })
    useContextMenuStore.getState().openMenu({
      x: 50,
      y: 75,
      items: [{ id: 'b', label: 'B' }]
    })
    const state = useContextMenuStore.getState()
    expect(state.x).toBe(50)
    expect(state.y).toBe(75)
    expect(state.items).toHaveLength(1)
    expect(state.items[0].id).toBe('b')
  })
})
