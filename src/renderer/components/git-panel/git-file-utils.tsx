/** Shared utilities for git file status display across panel components */

/** Color class for a git file status badge */
export function getStatusColor(status: string | undefined): string {
  switch (status) {
    case 'added':
    case 'staged':
    case 'untracked': return 'text-green-400'
    case 'modified': return 'text-amber-400'
    case 'deleted': return 'text-red-400'
    case 'renamed':
    case 'copied': return 'text-blue-400'
    default: return 'text-[var(--mc-text-muted)]'
  }
}

import React from 'react'

/** Single-letter label for a git file status */
export function getStatusLabel(status: string | undefined): React.ReactNode {
  switch (status) {
    case 'added':
    case 'staged':
    case 'untracked': 
      return (
        <svg className="w-3.5 h-3.5 transform translate-y-[-1px]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
        </svg>
      )
    case 'modified': 
      return (
        <svg className="w-3.5 h-3.5 transform translate-y-[-1px]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
        </svg>
      )
    case 'deleted': 
      return (
        <svg className="w-3.5 h-3.5 transform translate-y-[-1px]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
        </svg>
      )
    case 'renamed': 
    case 'copied':
      return (
        <svg className="w-3.5 h-3.5 transform translate-y-[-1px]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M14 5l7 7m0 0l-7 7m7-7H3" />
        </svg>
      )
    default: 
      return (
        <svg className="w-3.5 h-3.5 transform translate-y-[-1px]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      )
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
