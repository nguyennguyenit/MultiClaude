// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { AttachmentStrip } from './attachment-strip'
import { useImageStore, type ImageEntry } from '../../stores/image-store'

const readDataUrlMock = vi.fn<(filePath: string) => Promise<string | null>>()

beforeEach(() => {
  readDataUrlMock.mockReset()
  readDataUrlMock.mockResolvedValue('data:image/png;base64,AAA')
  useImageStore.setState({ images: {} })
  ;(window as unknown as { electron: { media: { readDataUrl: typeof readDataUrlMock } } }).electron = {
    media: { readDataUrl: readDataUrlMock }
  }
})

afterEach(() => {
  cleanup()
})

describe('<AttachmentStrip>', () => {
  it('renders null when image-store empty for terminalId', () => {
    const { container } = render(<AttachmentStrip terminalId="t1" onRemove={() => {}} />)
    expect(container.firstChild).toBeNull()
  })

  it('renders one tile per ImageEntry', async () => {
    act(() => {
      useImageStore.getState().addImage('t1', '/a.png', 'image')
      useImageStore.getState().addImage('t1', '/b.png', 'image')
    })
    render(<AttachmentStrip terminalId="t1" onRemove={() => {}} />)
    await waitFor(() => {
      expect(screen.getAllByRole('img').length).toBe(2)
    })
  })

  it('tile shows filename in title attribute', () => {
    act(() => {
      useImageStore.getState().addImage('t1', '/path/to/cat.png', 'image')
    })
    render(<AttachmentStrip terminalId="t1" onRemove={() => {}} />)
    expect(screen.getByTitle('cat.png')).toBeTruthy()
  })

  it('tile image loads src from readDataUrl', async () => {
    act(() => {
      useImageStore.getState().addImage('t1', '/photo.png', 'image')
    })
    render(<AttachmentStrip terminalId="t1" onRemove={() => {}} />)
    await waitFor(() => {
      const img = screen.getByAltText('photo.png') as HTMLImageElement
      expect(img.src).toBe('data:image/png;base64,AAA')
    })
    expect(readDataUrlMock).toHaveBeenCalledWith('/photo.png')
  })

  it('video entry shows video icon, no readDataUrl call', () => {
    act(() => {
      useImageStore.getState().addImage('t1', '/clip.mp4', 'video')
    })
    render(<AttachmentStrip terminalId="t1" onRemove={() => {}} />)
    expect(readDataUrlMock).not.toHaveBeenCalled()
    expect(screen.getByTestId('attachment-video-icon')).toBeTruthy()
    expect(screen.getByTitle('clip.mp4')).toBeTruthy()
  })

  it('✕ click invokes onRemove with filePath + entry', () => {
    let captured: ImageEntry | undefined
    act(() => {
      captured = useImageStore.getState().addImage('t1', '/foo.png', 'image')
    })
    const onRemove = vi.fn()
    render(<AttachmentStrip terminalId="t1" onRemove={onRemove} />)
    fireEvent.click(screen.getByLabelText('Remove foo.png'))
    expect(onRemove).toHaveBeenCalledWith('/foo.png', expect.objectContaining({
      filePath: '/foo.png',
      index: captured!.index
    }))
  })

  it('isolates tiles by terminalId', () => {
    act(() => {
      useImageStore.getState().addImage('t1', '/a.png', 'image')
      useImageStore.getState().addImage('t2', '/b.png', 'image')
    })
    render(<AttachmentStrip terminalId="t2" onRemove={() => {}} />)
    expect(screen.queryByTitle('a.png')).toBeNull()
    expect(screen.getByTitle('b.png')).toBeTruthy()
  })

  it('unmount during async load does not setState (no warning)', async () => {
    let resolve: ((v: string | null) => void) | null = null
    readDataUrlMock.mockImplementationOnce(() => new Promise<string | null>((r) => { resolve = r }))
    act(() => {
      useImageStore.getState().addImage('t1', '/slow.png', 'image')
    })
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const { unmount } = render(<AttachmentStrip terminalId="t1" onRemove={() => {}} />)
    unmount()
    await act(async () => {
      resolve?.('data:image/png;base64,LATE')
      await Promise.resolve()
    })
    expect(errorSpy).not.toHaveBeenCalled()
    errorSpy.mockRestore()
  })
})
