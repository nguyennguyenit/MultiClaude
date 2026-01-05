interface GitHubActionBarProps {
  repoName: string | undefined
  hasRemote: boolean
  syncing: boolean
  onPush: () => Promise<void>
  onPull: () => Promise<void>
  onSync: () => Promise<void>
  onFetch: () => Promise<void>
}

export function GitHubActionBar({
  repoName,
  hasRemote,
  syncing,
  onPush,
  onPull,
  onSync,
  onFetch
}: GitHubActionBarProps) {
  return (
    <div className="h-12 px-4 flex items-center justify-between bg-[var(--mc-bg-secondary)] border-b border-[var(--mc-border)]">
      {/* Left: Repository name */}
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-full bg-[var(--mc-bg-tertiary)] flex items-center justify-center text-[var(--mc-text-primary)]">
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
            <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
          </svg>
        </div>
        <div className="flex flex-col">
          <span className="text-[10px] uppercase tracking-wider text-[var(--mc-text-muted)] font-semibold leading-none mb-0.5">
            Current Repository
          </span>
          <span className="font-semibold text-sm text-[var(--mc-text-primary)]">
            {repoName || 'No repository selected'}
          </span>
        </div>
      </div>

      {/* Right: Action buttons */}
      {hasRemote && (
        <div className="flex items-center gap-2">
          <ActionButton
            icon={<PushIcon />}
            label="Push"
            onClick={onPush}
            disabled={syncing}
            shortcut="⇧⌘P"
          />
          <ActionButton
            icon={<PullIcon />}
            label="Pull"
            onClick={onPull}
            disabled={syncing}
            shortcut="⇧⌘L"
          />
          <div className="w-px h-4 bg-[var(--mc-border)] mx-1" />
          <ActionButton
            icon={<SyncIcon />}
            label="Sync"
            onClick={onSync}
            disabled={syncing}
            loading={syncing}
            primary
          />
          <ActionButton
            icon={<FetchIcon />}
            label="Fetch"
            onClick={onFetch}
            disabled={syncing}
          />
        </div>
      )}
    </div>
  )
}

function ActionButton({
  icon,
  label,
  onClick,
  disabled,
  loading,
  primary,
  shortcut
}: {
  icon: React.ReactNode
  label: string
  onClick: () => void
  disabled?: boolean
  loading?: boolean
  primary?: boolean
  shortcut?: string
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`
        px-3 py-1.5 text-xs font-medium rounded-md flex items-center gap-1.5 transition-all
        ${primary
          ? 'bg-[var(--mc-accent)] text-[var(--mc-bg-primary)] hover:opacity-90 shadow-sm'
          : 'bg-transparent text-[var(--mc-text-secondary)] hover:bg-[var(--mc-bg-tertiary)] hover:text-[var(--mc-text-primary)] border border-transparent hover:border-[var(--mc-border)]'
        }
        disabled:opacity-50 disabled:cursor-not-allowed
      `}
      title={shortcut ? `${label} (${shortcut})` : label}
    >
      <span className={loading ? 'animate-spin' : ''}>{icon}</span>
      <span>{label}</span>
    </button>
  )
}

function PushIcon() {
  return (
    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" />
    </svg>
  )
}

function PullIcon() {
  return (
    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
    </svg>
  )
}

function SyncIcon() {
  return (
    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
    </svg>
  )
}

function FetchIcon() {
  return (
    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3 3m0 0l3-3m-3 3V10" />
    </svg>
  )
}
