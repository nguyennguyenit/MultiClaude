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
  removeImage: (terminalId: string, filePath: string) => void
  getImages: (terminalId: string) => ImageEntry[]
  getImageByIndex: (terminalId: string, index: number) => ImageEntry | undefined
  clearTerminal: (terminalId: string) => void
  isTrackedImage: (filePath: string) => boolean
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

  getImageByIndex: (terminalId, index) => {
    const images = get().images[terminalId] || []
    return images.find((img) => img.index === index)
  },

  clearTerminal: (terminalId) =>
    set((state) => {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { [terminalId]: _removed, ...rest } = state.images
      return { images: rest }
    }),

  // Check if a file path is tracked by any terminal
  isTrackedImage: (filePath) => {
    const allImages = Object.values(get().images).flat()
    return allImages.some((img) => img.filePath === filePath)
  }
}))
