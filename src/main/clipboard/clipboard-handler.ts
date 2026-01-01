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
 * Save image from base64 data to temp folder
 * @param base64Data - Base64 encoded image data (without data URL prefix)
 * @returns File path if successful, null otherwise
 */
export function saveClipboardImage(base64Data: string): string | null {
  try {
    if (!base64Data) {
      console.log('[clipboard] No image data provided')
      return null
    }

    const dir = getScreenshotDir()
    const filename = generateFilename()
    const filePath = join(dir, filename)

    // Convert base64 to buffer and write to file
    const buffer = Buffer.from(base64Data, 'base64')
    writeFileSync(filePath, buffer)

    console.log('[clipboard] Image saved:', filePath)
    return filePath
  } catch (error) {
    console.error('Failed to save clipboard image:', error)
    return null
  }
}
