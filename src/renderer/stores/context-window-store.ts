import { create } from 'zustand'

interface ContextWindowState {
  isOpen: boolean
  toggle: () => void
  setOpen: (open: boolean) => void
}

export const useContextWindowStore = create<ContextWindowState>((set) => ({
  isOpen: false,
  toggle: () => set((s) => ({ isOpen: !s.isOpen })),
  setOpen: (open) => set({ isOpen: open })
}))
