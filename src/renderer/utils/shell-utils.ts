import type { WindowsShell } from '@shared/types'

/**
 * Get unique key for a WindowsShell option.
 * Used for React keys and comparison in shell selectors.
 */
export function getShellKey(shell: WindowsShell): string {
  if (shell.type === 'wsl') return `wsl:${shell.distro}`
  return shell.type
}
