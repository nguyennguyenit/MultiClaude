import { create } from 'zustand'

export interface ImageEntry {
  filePath: string
  timestamp: number
  index: number // 1-based index for [Image #X] reference
}

interface ImageState {
  // Images per terminal: terminalId → array of images
  images: Record<string, ImageEntry[]>
  addImage: (terminalId: string, filePath: string) => void
  getImages: (terminalId: string) => ImageEntry[]
}

export const useImageStore = create<ImageState>((set, get) => ({
  images: {},

  addImage: (terminalId, filePath) =>
    set((state) => {
      const existing = state.images[terminalId] || []
      const nextIndex = existing.length + 1
      return {
        images: {
          ...state.images,
          [terminalId]: [
            ...existing,
            { filePath, timestamp: Date.now(), index: nextIndex }
          ]
        }
      }
    }),

  getImages: (terminalId) => get().images[terminalId] || [],
}))
