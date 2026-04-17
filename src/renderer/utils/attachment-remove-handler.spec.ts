import { beforeEach, describe, expect, it } from 'vitest'
import { handleAttachmentRemove } from './attachment-remove-handler'
import { useImageStore, type ImageEntry } from '../stores/image-store'

describe('handleAttachmentRemove', () => {
  const terminalId = 't1'

  beforeEach(() => {
    useImageStore.setState({ images: {} })
  })

  function seedEntry(filePath: string): ImageEntry {
    return useImageStore.getState().addImage(terminalId, filePath, 'image')
  }

  it('removes the image from image-store (non-Claude mode)', () => {
    const entry = seedEntry('/a.png')
    handleAttachmentRemove({ terminalId, filePath: '/a.png', entry, isClaudeMode: false })
    expect(useImageStore.getState().getImages(terminalId)).toHaveLength(0)
  })

  it('removes the image from image-store (Claude mode)', () => {
    const entry = seedEntry('/a.png')
    handleAttachmentRemove({ terminalId, filePath: '/a.png', entry, isClaudeMode: true })
    expect(useImageStore.getState().getImages(terminalId)).toHaveLength(0)
  })

  it('no-op when filePath not in image-store', () => {
    seedEntry('/other.png')
    handleAttachmentRemove({
      terminalId,
      filePath: '/missing.png',
      entry: { filePath: '/missing.png', type: 'image', index: 1, timestamp: 0 },
      isClaudeMode: false
    })
    expect(useImageStore.getState().getImages(terminalId)).toHaveLength(1)
  })
})
