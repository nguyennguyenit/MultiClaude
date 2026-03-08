/** Shared utilities for git file status display across panel components */

/** Color class for a git file status badge */
export function getStatusColor(status: string | undefined): string {
  switch (status) {
    case 'added':
    case 'staged':
    case 'untracked': return 'text-green-400'
    case 'modified': return 'text-amber-400'
    case 'deleted': return 'text-red-400'
    case 'renamed': return 'text-blue-400'
    default: return 'text-[var(--mc-text-muted)]'
  }
}

/** Single-letter label for a git file status */
export function getStatusLabel(status: string | undefined): string {
  switch (status) {
    case 'added':
    case 'staged': return 'A'
    case 'modified': return 'M'
    case 'untracked': return 'U'
    case 'deleted': return 'D'
    case 'renamed': return 'R'
    default: return '?'
  }
}

/** Group files by parent directory. Works with any object that has a `path` string. */
export function groupByDir<T extends { path: string }>(files: T[]): Map<string, T[]> {
  const groups = new Map<string, T[]>()
  files.forEach(f => {
    const dir = f.path.split(/[/\\]/).slice(0, -1).join('/') || '.'
    const label = dir === '.' ? 'Root Path' : dir
    if (!groups.has(label)) groups.set(label, [])
    groups.get(label)!.push(f)
  })
  return groups
}
