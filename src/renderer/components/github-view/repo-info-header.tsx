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
  repoName,
  currentBranch,
  changesCount,
  branches,
  onCheckoutBranch,
  onCreateBranch,
  isLoading
}: RepoInfoHeaderProps) {
  return (
    <div className="px-4 py-3 bg-[var(--mc-bg-tertiary)] border-b border-[var(--mc-border)]">
      {/* Repository name */}
      <div className="flex items-center gap-2 text-sm mb-2">
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
        </svg>
        <span className="text-[var(--mc-text-muted)]">Repository:</span>
        <span className="font-medium">{repoName || 'Not connected'}</span>
      </div>

      {/* Branch and changes */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          {/* Branch selector */}
          <div className="flex items-center gap-2">
            <svg className="w-4 h-4 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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

        {/* Changes count */}
        <div className="flex items-center gap-2 text-sm">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
          </svg>
          <span className={changesCount > 0 ? 'text-amber-400' : 'text-[var(--mc-text-muted)]'}>
            {changesCount} changes
          </span>
        </div>
      </div>
    </div>
  )
}
