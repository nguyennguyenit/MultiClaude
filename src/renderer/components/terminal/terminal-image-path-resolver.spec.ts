import { describe, expect, it } from 'vitest'
import { resolveImagePathFromLine } from './terminal-image-path-resolver'

describe('resolveImagePathFromLine', () => {
  it('prefers the current terminal tracked image for Claude image references', () => {
    const resolvedPath = resolveImagePathFromLine({
      lineText: '> [Image #429]',
      trackedImages: [
        { filePath: '/tmp/older-terminal-image.png', index: 1 },
        { filePath: '/tmp/current-terminal-image.png', index: 429 }
      ],
      screenshotPaths: Array.from({ length: 10 }, (_, index) => `/tmp/screenshot-${index + 1}.png`)
    })

    expect(resolvedPath).toBe('/tmp/current-terminal-image.png')
  })

  it('falls back to screenshot ordering when the terminal store has no matching image index', () => {
    const resolvedPath = resolveImagePathFromLine({
      lineText: '> [Image #3]',
      trackedImages: [],
      screenshotPaths: [
        '/tmp/screenshot-1.png',
        '/tmp/screenshot-2.png',
        '/tmp/screenshot-3.png'
      ]
    })

    expect(resolvedPath).toBe('/tmp/screenshot-3.png')
  })
})
