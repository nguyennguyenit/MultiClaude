import { create } from 'zustand'

export interface ImageEntry {
  filePath: string
  timestamp: number
}

interface ImageState {
  // Images per terminal: terminalId → array of images
  images: Record<string, ImageEntry[]>
  addImage: (terminalId: string, filePath: string) => void
  removeImage: (terminalId: string, filePath: string) => void
  getImages: (terminalId: string) => ImageEntry[]
  clearTerminal: (terminalId: string) => void
  isTrackedImage: (filePath: string) => boolean
}

export const useImageStore = create<ImageState>((set, get) => ({
  images: {},

  addImage: (terminalId, filePath) =>
    set((state) => ({
      images: {
        ...state.images,
        [terminalId]: [
          ...(state.images[terminalId] || []),
          { filePath, timestamp: Date.now() }
        ]
      }
    })),

  removeImage: (terminalId, filePath) =>
    set((state) => ({
      images: {
        ...state.images,
        [terminalId]: (state.images[terminalId] || []).filter(
          (img) => img.filePath !== filePath
        )
      }
    })),

  getImages: (terminalId) => get().images[terminalId] || [],

  clearTerminal: (terminalId) =>
    set((state) => {
      const { [terminalId]: _, ...rest } = state.images
      return { images: rest }
    }),

  // Check if a file path is tracked by any terminal
  isTrackedImage: (filePath) => {
    const allImages = Object.values(get().images).flat()
    return allImages.some((img) => img.filePath === filePath)
  }
}))
