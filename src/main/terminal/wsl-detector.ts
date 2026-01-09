import { execSync } from 'child_process'
import type { WslDistro, WslInfo } from '@shared/types'

/**
 * Parse WSL command output (UTF-16 LE encoded on Windows)
 * Converts to proper string and removes BOM/null bytes
 */
function parseWslOutput(buffer: Buffer): string[] {
  // WSL outputs UTF-16 LE on Windows - convert properly
  let output: string

  // Check for UTF-16 LE BOM (FF FE)
  if (buffer[0] === 0xff && buffer[1] === 0xfe) {
    output = buffer.toString('utf16le')
  } else {
    // Try utf16le first (most common for wsl commands), fallback to utf8
    const utf16 = buffer.toString('utf16le')
    const utf8 = buffer.toString('utf8')
    // UTF-16 will have proper chars, UTF-8 misread as UTF-16 will have garbage
    output = utf16.includes('\0') ? utf8.replace(/\0/g, '') : utf16
  }

  return output
    .replace(/^\uFEFF/, '') // Remove BOM if present
    .replace(/\0/g, '') // Remove any remaining null bytes
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
}

/**
 * Detect WSL availability and installed distros (Windows only)
 * Returns { available: false, distros: [] } on non-Windows platforms
 */
export function detectWsl(): WslInfo {
  if (process.platform !== 'win32') {
    return { available: false, distros: [] }
  }

  try {
    // wsl --list --quiet returns distro names, one per line
    // Use buffer to handle Windows UTF-16 LE encoding
    const buffer = execSync('wsl --list --quiet', {
      timeout: 5000,
      windowsHide: true
    })

    const lines = parseWslOutput(buffer)

    if (lines.length === 0) {
      return { available: false, distros: [] }
    }

    // Get default distro name
    let defaultDistro = ''
    try {
      const defaultBuffer = execSync('wsl --list --verbose', {
        timeout: 5000,
        windowsHide: true
      })
      const defaultLines = parseWslOutput(defaultBuffer)
      // Find line starting with * (default distro)
      const defaultLine = defaultLines.find((line) => line.startsWith('*'))
      if (defaultLine) {
        // Extract distro name: "* Ubuntu   Running  2"
        const match = defaultLine.match(/^\*\s+(\S+)/)
        if (match) {
          defaultDistro = match[1]
        }
      }
    } catch {
      // Ignore - just won't mark default
    }

    const distros: WslDistro[] = lines.map((name) => ({
      name,
      isDefault: name === defaultDistro
    }))

    return { available: true, distros }
  } catch {
    // WSL not installed or command failed
    return { available: false, distros: [] }
  }
}
