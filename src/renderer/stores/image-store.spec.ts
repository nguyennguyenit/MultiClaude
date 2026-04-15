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
