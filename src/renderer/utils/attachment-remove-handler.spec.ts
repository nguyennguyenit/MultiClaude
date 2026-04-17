import { beforeEach, describe, expect, it, vi } from 'vitest'
import { handleAttachmentRemove } from './attachment-remove-handler'
import { useImageStore, type ImageEntry } from '../stores/image-store'
import { usePendingMediaStore } from '../stores/pending-media-store'
import { registerDisplayWriter } from '../stores/display-writer-registry'

describe('handleAttachmentRemove', () => {
  const terminalId = 't1'
  let writer: ReturnType<typeof vi.fn>

  beforeEach(() => {
    useImageStore.setState({ images: {} })
    usePendingMediaStore.setState({ queues: {} })
    writer = vi.fn()
    registerDisplayWriter(terminalId, writer as unknown as (text: string) => void)
  })

  function seedEntry(filePath: string): ImageEntry {
    return useImageStore.getState().addImage(terminalId, filePath, 'image')
  }

  it('non-Claude + only-last-token → removes from both stores + erases display', () => {
    const entry = seedEntry('/a.png')
    usePendingMediaStore.getState().push(terminalId, { path: '/a.png', displayLength: 9 })
    handleAttachmentRemove({ terminalId, filePath: '/a.png', entry, isClaudeMode: false })
    expect(useImageStore.getState().getImages(terminalId)).toHaveLength(0)
    expect(usePendingMediaStore.getState().getQueue(terminalId).tokens).toHaveLength(0)
    expect(writer).toHaveBeenCalledWith('\b \b'.repeat(10))
  })

  it('non-Claude + chars typed after token → removes from stores but does NOT erase display', () => {
    const entry = seedEntry('/a.png')
    usePendingMediaStore.getState().push(terminalId, { path: '/a.png', displayLength: 9 })
    usePendingMediaStore.getState().incrementCharsAfter(terminalId)
    handleAttachmentRemove({ terminalId, filePath: '/a.png', entry, isClaudeMode: false })
    expect(useImageStore.getState().getImages(terminalId)).toHaveLength(0)
    expect(usePendingMediaStore.getState().getQueue(terminalId).tokens).toHaveLength(0)
    expect(writer).not.toHaveBeenCalled()
  })

  it('non-Claude + middle-of-queue token → removes from stores but does NOT erase display', () => {
    const entry = seedEntry('/a.png')
    seedEntry('/b.png')
    usePendingMediaStore.getState().push(terminalId, { path: '/a.png', displayLength: 9 })
    usePendingMediaStore.getState().push(terminalId, { path: '/b.png', displayLength: 9 })
    handleAttachmentRemove({ terminalId, filePath: '/a.png', entry, isClaudeMode: false })
    const tokens = usePendingMediaStore.getState().getQueue(terminalId).tokens
    expect(tokens.map((t) => t.path)).toEqual(['/b.png'])
    expect(writer).not.toHaveBeenCalled()
  })

  it('Claude mode → removes from image-store only, does not touch pending queue or display', () => {
    const entry = seedEntry('/a.png')
    // In real Claude flow, pending queue stays untouched (no tokens pushed)
    usePendingMediaStore.getState().push(terminalId, { path: '/other.png', displayLength: 9 })
    handleAttachmentRemove({ terminalId, filePath: '/a.png', entry, isClaudeMode: true })
    expect(useImageStore.getState().getImages(terminalId)).toHaveLength(0)
    expect(usePendingMediaStore.getState().getQueue(terminalId).tokens).toHaveLength(1)
    expect(writer).not.toHaveBeenCalled()
  })

  it('no-op when filePath not in image-store', () => {
    handleAttachmentRemove({
      terminalId,
      filePath: '/missing.png',
      entry: { filePath: '/missing.png', type: 'image', index: 1, timestamp: 0 },
      isClaudeMode: false
    })
    expect(writer).not.toHaveBeenCalled()
  })
})
