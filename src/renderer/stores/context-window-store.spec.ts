import { describe, it, expect, beforeEach } from 'vitest'
import { useContextWindowStore } from './context-window-store'

describe('context-window-store', () => {
  beforeEach(() => {
    useContextWindowStore.setState({ isOpen: false })
  })

  it('starts closed', () => {
    expect(useContextWindowStore.getState().isOpen).toBe(false)
  })

  it('toggle flips isOpen', () => {
    useContextWindowStore.getState().toggle()
    expect(useContextWindowStore.getState().isOpen).toBe(true)
    useContextWindowStore.getState().toggle()
    expect(useContextWindowStore.getState().isOpen).toBe(false)
  })

  it('setOpen forces a specific value', () => {
    useContextWindowStore.getState().setOpen(true)
    expect(useContextWindowStore.getState().isOpen).toBe(true)
    useContextWindowStore.getState().setOpen(false)
    expect(useContextWindowStore.getState().isOpen).toBe(false)
  })
})
