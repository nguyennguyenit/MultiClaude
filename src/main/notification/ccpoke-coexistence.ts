import { readFile, readdir } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { join } from 'node:path'

export interface CcpokeDetectionOptions {
  /** Path to ~/.claude (or a test fixture root). */
  claudeDir: string
}

export interface CcpokeDetectionResult {
  detected: boolean
  reasons: string[]
}

/**
 * Detects ccpoke (opencode-notify) presence by filename or content marker
 * in `<claudeDir>/hooks/` plus ccpoke references in `<claudeDir>/settings.json`.
 * Never modifies any file.
 */
export async function detectCcpoke(options: CcpokeDetectionOptions): Promise<CcpokeDetectionResult> {
  const reasons: string[] = []
  const hooksDir = join(options.claudeDir, 'hooks')
  if (existsSync(hooksDir)) {
    try {
      const entries = await readdir(hooksDir)
      for (const name of entries) {
        if (!name.endsWith('.js') && !name.endsWith('.cjs') && !name.endsWith('.mjs')) continue
        if (name === 'opencode-notify.js' || name === 'opencode-notify.cjs') {
          reasons.push(`hooks/${name} (filename match)`)
          continue
        }
        try {
          const content = await readFile(join(hooksDir, name), 'utf8')
          if (/ccpoke|opencode-notify/i.test(content)) {
            reasons.push(`hooks/${name} (content marker)`)
          }
        } catch {
          // Ignore unreadable files.
        }
      }
    } catch {
      // Directory listing failure is not fatal.
    }
  }

  const settingsPath = join(options.claudeDir, 'settings.json')
  if (existsSync(settingsPath)) {
    try {
      const raw = await readFile(settingsPath, 'utf8')
      if (/opencode-notify|ccpoke/i.test(raw)) {
        reasons.push('settings.json references ccpoke hook')
      }
    } catch {
      // Malformed or unreadable settings — non-fatal.
    }
  }

  return { detected: reasons.length > 0, reasons }
}
