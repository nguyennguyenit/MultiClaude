import { clipboard } from 'electron'
import { existsSync, mkdirSync, writeFileSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'

/**
 * Get directory for saving screenshots
 * Creates directory if it doesn't exist
 */
export function getScreenshotDir(): string {
  const dir = join(tmpdir(), 'multiClaude-screenshots')
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true })
  }
  return dir
}

/**
 * Generate unique filename for screenshot
 */
function generateFilename(): string {
  const timestamp = Date.now()
  return `screenshot-${timestamp}.png`
}

/**
 * Save clipboard image to temp folder
 * @returns File path if image exists, null otherwise
 */
export function saveClipboardImage(): string | null {
  try {
    const image = clipboard.readImage()

    // Check if clipboard has an image
    if (image.isEmpty()) {
      return null
    }

    const dir = getScreenshotDir()
    const filename = generateFilename()
    const filePath = join(dir, filename)

    // Get PNG buffer and write to file
    const buffer = image.toPNG()
    writeFileSync(filePath, buffer)

    return filePath
  } catch (error) {
    console.error('Failed to save clipboard image:', error)
    return null
  }
}
