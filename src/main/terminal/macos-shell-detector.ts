import * as fs from 'fs'
import * as path from 'path'
import os from 'os'
import { execFileSync } from 'child_process'
import type { ShellInfo } from '@shared/types'

const COMMON_SHELL_DIRS = [
  '/opt/homebrew/bin',
  '/usr/local/bin',
  '/bin',
  '/usr/bin',
]

const COMMON_SHELL_NAMES = ['zsh', 'bash', 'fish', 'sh', 'tcsh', 'ksh']
const MAX_ETC_SHELLS_ENTRIES = 50
const USERNAME_RE = /^[a-z_][a-z0-9_.-]{0,30}$/
const ABSOLUTE_PATH_RE = /^\/[a-zA-Z0-9._/-]+$/

/**
 * Resolve the user's default login shell.
 * Priority: $SHELL env var → dscl (macOS) → /bin/sh fallback.
 */
function resolveDefaultShell(): string {
  // 1. $SHELL is the most reliable (no command execution needed)
  if (process.env.SHELL) return process.env.SHELL

  // 2. Try dscl on macOS — use execFileSync with arg array to prevent injection
  if (process.platform === 'darwin') {
    try {
      const username = os.userInfo().username
      if (USERNAME_RE.test(username)) {
        const result = execFileSync(
          '/usr/bin/dscl',
          ['.', '-read', `/Users/${username}`, 'UserShell'],
          { timeout: 2000, encoding: 'utf8' }
        )
        const match = result.toString().match(/UserShell:\s+(.+)/)
        if (match?.[1]) return match[1].trim()
      }
    } catch {
      // Timeout, network issue, or dscl unavailable — fall through
    }
  }

  return '/bin/sh'
}

/**
 * Validate that a shell path from /etc/shells is safe:
 * - Must be absolute (starts with /)
 * - Must not contain path traversal (..)
 * - Must match the allowed character set
 */
function isValidEtcShellEntry(entry: string): boolean {
  if (!entry.startsWith('/')) return false
  if (entry.includes('..')) return false
  return ABSOLUTE_PATH_RE.test(entry)
}

/**
 * Check if a path is an executable file or symlink.
 * Resolves via realpathSync — throws on broken symlinks.
 */
function isExecutableShell(shellPath: string): boolean {
  try {
    fs.accessSync(shellPath, fs.constants.X_OK)
    const stat = fs.statSync(shellPath)
    return stat.isFile() || stat.isSymbolicLink()
  } catch {
    return false
  }
}

/**
 * Parse /etc/shells — returns valid absolute paths, capped at MAX_ETC_SHELLS_ENTRIES.
 */
function parseEtcShells(): string[] {
  try {
    const content = fs.readFileSync('/etc/shells', 'utf8')
    return content
      .split('\n')
      .map(l => l.trim())
      .filter(l => l.length > 0 && !l.startsWith('#'))
      .filter(isValidEtcShellEntry)
      .slice(0, MAX_ETC_SHELLS_ENTRIES)
  } catch {
    return []
  }
}

/**
 * Scan common directories for known shell executables.
 * Used as fallback when /etc/shells is missing or empty.
 */
function scanCommonDirs(): string[] {
  const candidates: string[] = []
  for (const dir of COMMON_SHELL_DIRS) {
    for (const name of COMMON_SHELL_NAMES) {
      candidates.push(path.join(dir, name))
    }
  }
  return candidates
}

/**
 * Extract display name from shell path.
 * Handles versioned paths: /usr/local/bin/fish-3.7.1 → 'fish'
 */
function extractShellName(shellPath: string): string {
  return path.basename(shellPath).split('-')[0].toLowerCase()
}

/**
 * Detect available shells on macOS/Linux.
 * Returns [] on Windows.
 *
 * Detection algorithm:
 * 1. Resolve default shell from $SHELL / dscl
 * 2. Parse /etc/shells (validated + capped)
 * 3. Scan common fallback dirs
 * 4. Deduplicate via realpathSync
 * 5. Filter: must be executable
 * 6. Sort: default first, then alphabetical by name
 */
export async function detectMacosShells(): Promise<ShellInfo[]> {
  if (process.platform === 'win32') return []

  const defaultShellRaw = resolveDefaultShell()

  // Collect candidates: default shell first, then /etc/shells; scan common dirs only as fallback
  const etcShells = parseEtcShells()
  const rawCandidates = etcShells.length > 0
    ? [defaultShellRaw, ...etcShells]
    : [defaultShellRaw, ...scanCommonDirs()]

  // Apply cap *before* dedup (total unique may still be <= cap due to dedup)
  const candidates = rawCandidates.slice(0, MAX_ETC_SHELLS_ENTRIES)

  // Deduplicate via realpathSync — store the resolved path
  const seen = new Map<string, ShellInfo>()

  let defaultResolvedPath: string | null = null
  try {
    defaultResolvedPath = fs.realpathSync(defaultShellRaw)
  } catch {
    defaultResolvedPath = defaultShellRaw
  }

  for (const candidate of candidates) {
    if (!isExecutableShell(candidate)) continue

    let resolved: string
    try {
      resolved = fs.realpathSync(candidate)
    } catch {
      continue // broken symlink
    }

    if (seen.has(resolved)) continue

    seen.set(resolved, {
      path: resolved,
      name: extractShellName(candidate),
      isDefault: resolved === defaultResolvedPath,
      kind: 'unix',
    })
  }

  const shells = Array.from(seen.values())

  // Sort: default first, then alphabetical by name
  shells.sort((a, b) => {
    if (a.isDefault && !b.isDefault) return -1
    if (!a.isDefault && b.isDefault) return 1
    return a.name.localeCompare(b.name)
  })

  return shells
}
