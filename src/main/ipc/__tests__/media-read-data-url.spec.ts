import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockExistsSync = vi.hoisted(() => vi.fn())
const mockReadFileSync = vi.hoisted(() => vi.fn())

vi.mock('fs', async () => {
  const actual = await vi.importActual<typeof import('fs')>('fs')
  return {
    ...actual,
    existsSync: mockExistsSync,
    readFileSync: mockReadFileSync
  }
})

const mockCreateFromPath = vi.hoisted(() => vi.fn())

vi.mock('electron', () => ({
  nativeImage: {
    createFromPath: mockCreateFromPath
  }
}))

import { readMediaDataUrl } from '../media-read-data-url-handler'

function makeImage({ empty, dataUrl }: { empty: boolean; dataUrl: string }) {
  return {
    isEmpty: () => empty,
    resize: vi.fn().mockReturnThis(),
    toDataURL: () => dataUrl
  }
}

describe('readMediaDataUrl', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns null for non-existent path', () => {
    mockExistsSync.mockReturnValue(false)
    const result = readMediaDataUrl('/missing/file.png')
    expect(result).toBeNull()
  })

  it('returns null for non-image extension (.txt)', () => {
    mockExistsSync.mockReturnValue(true)
    const result = readMediaDataUrl('/foo.txt')
    expect(result).toBeNull()
  })

  it('returns null for pdf extension', () => {
    mockExistsSync.mockReturnValue(true)
    const result = readMediaDataUrl('/foo.pdf')
    expect(result).toBeNull()
  })

  it('returns null for video extension (.mp4)', () => {
    mockExistsSync.mockReturnValue(true)
    const result = readMediaDataUrl('/clip.mp4')
    expect(result).toBeNull()
  })

  it('returns data URL for valid png', () => {
    mockExistsSync.mockReturnValue(true)
    const img = makeImage({ empty: false, dataUrl: 'data:image/png;base64,AAA' })
    mockCreateFromPath.mockReturnValue(img)
    const result = readMediaDataUrl('/photo.png')
    expect(result).toBe('data:image/png;base64,AAA')
    expect(img.resize).toHaveBeenCalledWith({ width: 160, quality: 'good' })
  })

  it('returns data URL for valid jpg (case-insensitive extension)', () => {
    mockExistsSync.mockReturnValue(true)
    const img = makeImage({ empty: false, dataUrl: 'data:image/jpeg;base64,BBB' })
    mockCreateFromPath.mockReturnValue(img)
    const result = readMediaDataUrl('/UPPER.JPG')
    expect(result).toBe('data:image/jpeg;base64,BBB')
  })

  it('SVG fallback uses base64 readFileSync embed', () => {
    mockExistsSync.mockReturnValue(true)
    const img = makeImage({ empty: true, dataUrl: '' })
    mockCreateFromPath.mockReturnValue(img)
    mockReadFileSync.mockReturnValue(Buffer.from('<svg/>'))
    const result = readMediaDataUrl('/icon.svg')
    expect(result).toMatch(/^data:image\/svg\+xml;base64,/)
    expect(Buffer.from(result!.split(',')[1], 'base64').toString()).toBe('<svg/>')
  })

  it('rejects path traversal when extension invalid (e.g. ../etc/passwd)', () => {
    mockExistsSync.mockReturnValue(true)
    const result = readMediaDataUrl('../../etc/passwd')
    expect(result).toBeNull()
  })

  it('returns null when nativeImage produces empty non-svg image', () => {
    mockExistsSync.mockReturnValue(true)
    const img = makeImage({ empty: true, dataUrl: '' })
    mockCreateFromPath.mockReturnValue(img)
    const result = readMediaDataUrl('/corrupt.png')
    expect(result).toBeNull()
  })
})
