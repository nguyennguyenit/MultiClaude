import { create } from 'zustand'

export type MediaType = 'image' | 'video'

export interface ImageEntry {
  filePath: string
  timestamp: number
  type: MediaType
  index: number // 1-based index per type
}

interface ImageState {
  images: Record<string, ImageEntry[]>
  addImage: (terminalId: string, filePath: string, type?: MediaType) => ImageEntry
  getImages: (terminalId: string) => ImageEntry[]
  clearImages: (terminalId: string) => void
  // Removes first matching entry by filePath. Returns removed entry (caller
  // may use `index` / `displayLength` to drive xterm backspace) or null.
  // Intentionally does NOT re-index remaining entries — keeps [Image N] refs
  // stable with anything already rendered in xterm / Claude Code.
  removeImage: (terminalId: string, filePath: string) => ImageEntry | null
}

export const useImageStore = create<ImageState>((set, get) => ({
  images: {},

  addImage: (terminalId, filePath, type = 'image') => {
    const existing = get().images[terminalId] || []
    const sameType = existing.filter((e) => e.type === type)
    const entry: ImageEntry = {
      filePath,
      timestamp: Date.now(),
      type,
      index: sameType.length + 1
    }
    set((state) => ({
      images: {
        ...state.images,
        [terminalId]: [...(state.images[terminalId] || []), entry]
      }
    }))
    return entry
  },

  getImages: (terminalId) => get().images[terminalId] || [],

  clearImages: (terminalId) =>
    set((state) => {
      const { [terminalId]: _, ...rest } = state.images
      return { images: rest }
    }),

  removeImage: (terminalId, filePath) => {
    const current = get().images[terminalId]
    if (!current || current.length === 0) return null
    const idx = current.findIndex((e) => e.filePath === filePath)
    if (idx === -1) return null
    const removed = current[idx]
    const next = [...current.slice(0, idx), ...current.slice(idx + 1)]
    set((state) => ({
      images: { ...state.images, [terminalId]: next }
    }))
    return removed
  }
}))
