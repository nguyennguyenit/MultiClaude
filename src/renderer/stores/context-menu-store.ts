import { create } from 'zustand'

export interface ContextMenuItem {
  id: string
  label: string
  shortcut?: string
  disabled?: boolean
  separator?: boolean
  title?: string
  onSelect?: () => void
}

interface OpenPayload {
  x: number
  y: number
  items: ContextMenuItem[]
}

interface ContextMenuState {
  open: boolean
  x: number
  y: number
  items: ContextMenuItem[]
  openMenu: (payload: OpenPayload) => void
  closeMenu: () => void
}

export const useContextMenuStore = create<ContextMenuState>((set) => ({
  open: false,
  x: 0,
  y: 0,
  items: [],
  openMenu: ({ x, y, items }) => set({ open: true, x, y, items }),
  closeMenu: () => set({ open: false, x: 0, y: 0, items: [] })
}))
