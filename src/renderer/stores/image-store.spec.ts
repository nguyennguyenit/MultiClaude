import { beforeEach, describe, expect, it } from 'vitest'
import { useImageStore } from './image-store'

describe('useImageStore - media type support', () => {
  beforeEach(() => {
    useImageStore.setState({ images: {} })
  })

  it('addImage returns entry with type and 1-based index', () => {
    const entry = useImageStore.getState().addImage('t1', '/foo.png', 'image')
    expect(entry.type).toBe('image')
    expect(entry.index).toBe(1)
    expect(entry.filePath).toBe('/foo.png')
  })

  it('indexes images and videos independently', () => {
    useImageStore.getState().addImage('t1', '/a.png', 'image')
    useImageStore.getState().addImage('t1', '/b.mp4', 'video')
    const e3 = useImageStore.getState().addImage('t1', '/c.jpg', 'image')
    const e4 = useImageStore.getState().addImage('t1', '/d.mov', 'video')
    expect(e3.index).toBe(2)
    expect(e4.index).toBe(2)
  })

  it('defaults type to image when not specified', () => {
    const entry = useImageStore.getState().addImage('t1', '/foo.png')
    expect(entry.type).toBe('image')
  })

  it('clearImages removes all entries for a terminal', () => {
    useImageStore.getState().addImage('t1', '/foo.png', 'image')
    useImageStore.getState().clearImages('t1')
    expect(useImageStore.getState().getImages('t1')).toHaveLength(0)
  })

  it('clearImages does not affect other terminals', () => {
    useImageStore.getState().addImage('t1', '/foo.png', 'image')
    useImageStore.getState().addImage('t2', '/bar.png', 'image')
    useImageStore.getState().clearImages('t1')
    expect(useImageStore.getState().getImages('t2')).toHaveLength(1)
  })
})

describe('useImageStore - removeImage', () => {
  beforeEach(() => {
    useImageStore.setState({ images: {} })
  })

  it('returns null when terminal has no entries', () => {
    const removed = useImageStore.getState().removeImage('t1', '/foo.png')
    expect(removed).toBeNull()
  })

  it('returns null when filePath not found', () => {
    useImageStore.getState().addImage('t1', '/foo.png', 'image')
    const removed = useImageStore.getState().removeImage('t1', '/missing.png')
    expect(removed).toBeNull()
    expect(useImageStore.getState().getImages('t1')).toHaveLength(1)
  })

  it('removes first matching entry and returns it', () => {
    const added = useImageStore.getState().addImage('t1', '/foo.png', 'image')
    const removed = useImageStore.getState().removeImage('t1', '/foo.png')
    expect(removed).not.toBeNull()
    expect(removed!.filePath).toBe('/foo.png')
    expect(removed!.index).toBe(added.index)
    expect(useImageStore.getState().getImages('t1')).toHaveLength(0)
  })

  it('with duplicates removes only first occurrence', () => {
    const first = useImageStore.getState().addImage('t1', '/foo.png', 'image')
    const second = useImageStore.getState().addImage('t1', '/foo.png', 'image')
    const removed = useImageStore.getState().removeImage('t1', '/foo.png')
    expect(removed!.timestamp).toBe(first.timestamp)
    expect(removed!.index).toBe(first.index)
    const remaining = useImageStore.getState().getImages('t1')
    expect(remaining).toHaveLength(1)
    expect(remaining[0].index).toBe(second.index)
  })

  it('preserves indices of remaining entries (no re-index)', () => {
    useImageStore.getState().addImage('t1', '/a.png', 'image')
    useImageStore.getState().addImage('t1', '/b.png', 'image')
    useImageStore.getState().addImage('t1', '/c.png', 'image')
    useImageStore.getState().removeImage('t1', '/a.png')
    const remaining = useImageStore.getState().getImages('t1')
    expect(remaining.map((e) => e.index)).toEqual([2, 3])
    expect(remaining.map((e) => e.filePath)).toEqual(['/b.png', '/c.png'])
  })

  it('is isolated per terminalId', () => {
    useImageStore.getState().addImage('t1', '/foo.png', 'image')
    useImageStore.getState().addImage('t2', '/foo.png', 'image')
    useImageStore.getState().removeImage('t1', '/foo.png')
    expect(useImageStore.getState().getImages('t1')).toHaveLength(0)
    expect(useImageStore.getState().getImages('t2')).toHaveLength(1)
  })
})
