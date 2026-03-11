import { BranchSelector } from '../git-panel/branch-selector'
import type { GitBranch } from '@shared/types'

interface CompactHeaderProps {
  currentBranch: string | undefined
  branches: GitBranch[]
  hasRemote: boolean
  syncing: boolean
  isLoading: boolean
  onCheckoutBranch: (name: string) => Promise<void>
  onCreateBranch: (name: string) => Promise<void>
  onFetch: () => void
  onPull: () => void
  onPush: () => void
}

export function CompactHeader({
  currentBranch,
  branches,
  hasRemote,
  syncing,
  isLoading,
  onCheckoutBranch,
  onCreateBranch,
  onFetch,
  onPull,
  onPush
}: CompactHeaderProps) {
  return (
    <div className="flex items-center justify-between px-2.5 border-b border-[var(--mc-border)] flex-shrink-0 gap-2" style={{ height: 40, marginTop: 4 }}>
      {/* Branch selector */}
      <BranchSelector
        currentBranch={currentBranch}
        branches={branches}
        onCheckout={onCheckoutBranch}
        onCreate={onCreateBranch}
        isLoading={isLoading}
      />

      {/* Remote action icons */}
      {hasRemote && (
        <div className="flex items-center gap-0.5">
          <IconButton onClick={onFetch} disabled={syncing} title="Fetch">
            {/* Download/fetch icon */}
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3 3m0 0l3-3m-3 3V10" />
            </svg>
          </IconButton>
          <IconButton onClick={onPull} disabled={syncing} title="Pull">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
            </svg>
          </IconButton>
          <IconButton onClick={onPush} disabled={syncing} title="Push">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" />
            </svg>
          </IconButton>
        </div>
      )}
    </div>
  )
}

function IconButton({
  onClick,
  disabled,
  title,
  children
}: {
  onClick: () => void
  disabled?: boolean
  title: string
  children: React.ReactNode
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title}
      style={{
        width: 24,
        height: 24,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: 4,
        border: '1px solid rgba(255, 255, 255, 0.1)',
        background: 'transparent',
        color: 'var(--mc-text-secondary, #8b949e)',
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.4 : 1,
        transition: 'all 0.15s ease',
        padding: 0,
      }}
      onMouseEnter={e => {
        if (!disabled) {
          e.currentTarget.style.color = 'var(--mc-accent, #58a6ff)'
          e.currentTarget.style.background = 'var(--mc-bg-hover, rgba(255,255,255,0.05))'
          e.currentTarget.style.borderColor = 'rgba(88, 166, 255, 0.4)'
        }
      }}
      onMouseLeave={e => {
        if (!disabled) {
          e.currentTarget.style.color = 'var(--mc-text-secondary, #8b949e)'
          e.currentTarget.style.background = 'transparent'
          e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.1)'
        }
      }}
    >
      {children}
    </button>
  )
}
