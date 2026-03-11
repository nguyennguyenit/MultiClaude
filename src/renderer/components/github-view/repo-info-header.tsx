import { BranchSelector } from '../git-panel/branch-selector'
import type { GitBranch } from '@shared/types'

interface RepoInfoHeaderProps {
  repoName: string | undefined
  currentBranch: string | undefined
  changesCount: number
  branches: GitBranch[]
  onCheckoutBranch: (name: string) => Promise<void>
  onCreateBranch: (name: string) => Promise<void>
  isLoading: boolean
}

export function RepoInfoHeader({
  repoName: _repoName,
  currentBranch,
  changesCount,
  branches,
  onCheckoutBranch,
  onCreateBranch,
  isLoading
}: RepoInfoHeaderProps) {
  return (
    <div className="px-4 py-3 bg-[var(--mc-bg-tertiary)] border-b border-[var(--mc-border)] flex items-center justify-between">
      {/* Branch selector */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2 px-2 py-1 rounded bg-[var(--mc-bg-secondary)] border border-[var(--mc-border)]">
          <svg className="w-3.5 h-3.5 text-[var(--mc-accent)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
          </svg>
          <BranchSelector
            currentBranch={currentBranch}
            branches={branches}
            onCheckout={onCheckoutBranch}
            onCreate={onCreateBranch}
            isLoading={isLoading}
          />
        </div>
      </div>

      {/* Changes count badge */}
      <div className={`
        flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border
        ${changesCount > 0
          ? 'bg-amber-400/10 text-amber-500 border-amber-400/20'
          : 'bg-[var(--mc-bg-secondary)] text-[var(--mc-text-muted)] border-[var(--mc-border)]'
        }
      `}>
        <span className="relative flex h-2 w-2">
          {changesCount > 0 && (
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
          )}
          <span className={`relative inline-flex rounded-full h-2 w-2 ${changesCount > 0 ? 'bg-amber-500' : 'bg-[var(--mc-text-muted)]'}`}></span>
        </span>
        <span>
          {changesCount} changed file{changesCount !== 1 ? 's' : ''}
        </span>
      </div>
    </div>
  )
}
