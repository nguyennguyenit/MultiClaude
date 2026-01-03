import type { GitBranch } from '@shared/types'

interface BranchesTabProps {
  branches: GitBranch[]
  currentBranch: string | undefined
  isLoading?: boolean
  onCheckout: (name: string) => Promise<void>
  onDelete: (name: string, force?: boolean) => Promise<void>
  onMerge: (name: string) => Promise<void>
}

export function BranchesTab({
  branches,
  currentBranch,
  isLoading,
  onCheckout,
  onDelete,
  onMerge
}: BranchesTabProps) {
  const localBranches = branches.filter(b => !b.isRemote)
  const remoteBranches = branches.filter(b => b.isRemote)

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center text-xs text-[var(--mc-text-muted)]">
        Loading branches...
      </div>
    )
  }

  const handleDelete = async (name: string) => {
    if (confirm(`Delete branch '${name}'?`)) {
      await onDelete(name)
    }
  }

  const handleMerge = async (name: string) => {
    if (confirm(`Merge '${name}' into '${currentBranch}'?`)) {
      await onMerge(name)
    }
  }

  return (
    <div className="flex-1 overflow-y-auto">
      {/* Local branches */}
      <div className="px-3 py-1.5 text-[10px] uppercase text-[var(--mc-text-muted)] bg-[var(--mc-bg-hover)]">
        Local ({localBranches.length})
      </div>
      {localBranches.map((branch) => (
        <div
          key={branch.name}
          className="px-3 py-2 border-b border-[var(--mc-border)] hover:bg-[var(--mc-bg-hover)] flex items-center justify-between"
        >
          <div className="flex items-center gap-2 flex-1 min-w-0">
            {branch.current ? (
              <svg className="w-3 h-3 text-green-400 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
            ) : (
              <div className="w-3" />
            )}
            <span className={`text-xs truncate ${branch.current ? 'text-green-400 font-medium' : ''}`}>
              {branch.name}
            </span>
          </div>
          {!branch.current && (
            <div className="flex items-center gap-1">
              <button
                onClick={() => onCheckout(branch.name)}
                title="Checkout"
                className="p-1 hover:bg-[var(--mc-bg-active)] rounded text-blue-400"
              >
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
              <button
                onClick={() => handleMerge(branch.name)}
                title="Merge into current"
                className="p-1 hover:bg-[var(--mc-bg-active)] rounded text-purple-400"
              >
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
              </button>
              <button
                onClick={() => handleDelete(branch.name)}
                title="Delete"
                className="p-1 hover:bg-[var(--mc-bg-active)] rounded text-red-400"
              >
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>
            </div>
          )}
        </div>
      ))}

      {/* Remote branches */}
      {remoteBranches.length > 0 && (
        <>
          <div className="px-3 py-1.5 text-[10px] uppercase text-[var(--mc-text-muted)] bg-[var(--mc-bg-hover)]">
            Remote ({remoteBranches.length})
          </div>
          {remoteBranches.map((branch) => (
            <div
              key={branch.name}
              className="px-3 py-2 border-b border-[var(--mc-border)] hover:bg-[var(--mc-bg-hover)] flex items-center justify-between"
            >
              <div className="flex items-center gap-2 flex-1 min-w-0">
                <div className="w-3" />
                <span className="text-xs text-[var(--mc-text-muted)] truncate">{branch.name}</span>
              </div>
              <button
                onClick={() => onCheckout(branch.name.replace('origin/', ''))}
                title="Checkout as local"
                className="p-1 hover:bg-[var(--mc-bg-active)] rounded text-blue-400"
              >
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
            </div>
          ))}
        </>
      )}
    </div>
  )
}
