import { describe, expect, it } from 'vitest'
import { buildMediaToken, classifyMediaFile } from './media-classifier'

describe('classifyMediaFile', () => {
  it('classifies common image extensions', () => {
    expect(classifyMediaFile('/a/b.PNG')).toBe('image')
    expect(classifyMediaFile('x.jpg')).toBe('image')
    expect(classifyMediaFile('x.jpeg')).toBe('image')
    expect(classifyMediaFile('x.gif')).toBe('image')
    expect(classifyMediaFile('x.webp')).toBe('image')
    expect(classifyMediaFile('x.bmp')).toBe('image')
    expect(classifyMediaFile('x.svg')).toBe('image')
  })

  it('classifies common video extensions', () => {
    expect(classifyMediaFile('a.mp4')).toBe('video')
    expect(classifyMediaFile('a.MOV')).toBe('video')
    expect(classifyMediaFile('a.avi')).toBe('video')
    expect(classifyMediaFile('a.mkv')).toBe('video')
    expect(classifyMediaFile('a.webm')).toBe('video')
    expect(classifyMediaFile('a.m4v')).toBe('video')
    expect(classifyMediaFile('a.wmv')).toBe('video')
  })

  it('returns null for unknown and no-extension', () => {
    expect(classifyMediaFile('file.txt')).toBeNull()
    expect(classifyMediaFile('noext')).toBeNull()
    expect(classifyMediaFile('')).toBeNull()
  })
})

describe('buildMediaToken', () => {
  it('builds image token', () => {
    expect(buildMediaToken('image', 3)).toBe('[Image 3]')
  })
  it('builds video token', () => {
    expect(buildMediaToken('video', 1)).toBe('[Video 1]')
  })
})
