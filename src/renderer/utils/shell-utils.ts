import type { WindowsShell, ShellInfo } from '@shared/types'

/**
 * Get unique key for a WindowsShell option.
 * Used for React keys and comparison in shell selectors.
 */
export function getShellKey(shell: WindowsShell): string {
  if (shell.type === 'wsl') return `wsl:${shell.distro}`
  return shell.type
}

/**
 * Convert a ShellInfo (from the unified IPC list) back to a WindowsShell.
 * Uses the `kind` discriminant — no name-matching heuristics (H4 fix).
 */
export function shellInfoToWindowsShell(info: ShellInfo): WindowsShell {
  switch (info.kind) {
    case 'wsl': return { type: 'wsl', distro: info.name }
    case 'powershell': return { type: 'powershell' }
    case 'cmd': return { type: 'cmd' }
    default: return { type: 'cmd' }
  }
}
