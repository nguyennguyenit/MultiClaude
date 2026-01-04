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
    <div className="h-10 px-4 flex items-center justify-between bg-[var(--mc-bg-secondary)] border-b border-[var(--mc-border)]">
      {/* Left: Repository name */}
      <div className="flex items-center gap-2 text-sm">
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
        <span className="font-medium">
          {repoName || 'No repository'}
        </span>
      </div>

      {/* Right: Action buttons */}
      {hasRemote && (
        <div className="flex items-center gap-1">
          <ActionButton
            icon={<PushIcon />}
            label="Push"
            onClick={onPush}
            disabled={syncing}
          />
          <ActionButton
            icon={<PullIcon />}
            label="Pull"
            onClick={onPull}
            disabled={syncing}
          />
          <ActionButton
            icon={<SyncIcon />}
            label="Sync"
            onClick={onSync}
            disabled={syncing}
            loading={syncing}
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
  loading
}: {
  icon: React.ReactNode
  label: string
  onClick: () => void
  disabled?: boolean
  loading?: boolean
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="px-2 py-1 text-xs rounded hover:bg-[var(--mc-bg-hover)] disabled:opacity-50 flex items-center gap-1"
      title={label}
    >
      <span className={loading ? 'animate-spin' : ''}>{icon}</span>
      <span>{label}</span>
    </button>
  )
}

function PushIcon() {
  return (
    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" />
    </svg>
  )
}

function PullIcon() {
  return (
    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
    </svg>
  )
}

function SyncIcon() {
  return (
    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
    </svg>
  )
}

function FetchIcon() {
  return (
    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3 3m0 0l3-3m-3 3V10" />
    </svg>
  )
}
