import { execSync } from 'child_process'
import type { WslDistro, WslInfo } from '@shared/types'

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
    // Default distro has * prefix (only in verbose mode)
    const output = execSync('wsl --list --quiet', {
      encoding: 'utf-8',
      timeout: 5000,
      windowsHide: true
    })

    // Parse output - remove empty lines and BOM
    const lines = output
      .replace(/^\uFEFF/, '') // Remove UTF-16 BOM if present
      .split('\n')
      .map(line => line.trim().replace(/\0/g, '')) // Remove null bytes (Windows encoding)
      .filter(line => line.length > 0)

    if (lines.length === 0) {
      return { available: false, distros: [] }
    }

    // Get default distro name
    let defaultDistro = ''
    try {
      const defaultOutput = execSync('wsl --list --verbose', {
        encoding: 'utf-8',
        timeout: 5000,
        windowsHide: true
      })
      const defaultMatch = defaultOutput.match(/^\s*\*\s+(\S+)/m)
      if (defaultMatch) {
        defaultDistro = defaultMatch[1]
      }
    } catch {
      // Ignore - just won't mark default
    }

    const distros: WslDistro[] = lines.map(name => ({
      name,
      isDefault: name === defaultDistro
    }))

    return { available: true, distros }
  } catch {
    // WSL not installed or command failed
    return { available: false, distros: [] }
  }
}
