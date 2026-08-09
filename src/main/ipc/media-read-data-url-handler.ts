import { existsSync, readFileSync } from 'fs'
import { nativeImage } from 'electron'

const IMAGE_EXTENSIONS = new Set([
  '.png',
  '.jpg',
  '.jpeg',
  '.gif',
  '.webp',
  '.bmp',
  '.svg'
])

const THUMBNAIL_WIDTH = 160

function getExtension(filePath: string): string {
  const dot = filePath.lastIndexOf('.')
  if (dot === -1) return ''
  return filePath.slice(dot).toLowerCase()
}

/**
 * Read a validated image path and return a thumbnail-sized base64 data URL.
 * Returns null for missing files, non-image extensions, or unreadable images.
 * Videos return null — renderer shows a placeholder icon.
 */
export function readMediaDataUrl(filePath: string): string | null {
  if (!existsSync(filePath)) return null
  const ext = getExtension(filePath)
  if (!IMAGE_EXTENSIONS.has(ext)) return null

  const img = nativeImage.createFromPath(filePath)
  if (!img.isEmpty()) {
    return img.resize({ width: THUMBNAIL_WIDTH, quality: 'good' }).toDataURL()
  }

  // SVG path: nativeImage returns empty on macOS + many Linux builds.
  // Read bytes and base64-embed so renderer can still display the image.
  if (ext === '.svg') {
    const bytes = readFileSync(filePath)
    return `data:image/svg+xml;base64,${bytes.toString('base64')}`
  }

  return null
}
