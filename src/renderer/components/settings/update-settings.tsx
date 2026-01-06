import { useEffect } from 'react'
import { useUpdateStore } from '../../stores'

const GITHUB_REPO = 'nguyennguyenit/MultiClaude'

export function UpdateSettings() {
  const { state, loadState, checkForUpdates, downloadUpdate, installUpdate } = useUpdateStore()
  const { status, currentVersion, latestVersion, releaseNotes, downloadProgress, error } = state

  useEffect(() => {
    loadState()
  }, [loadState])

  const hasUpdate = status === 'available' || status === 'downloading' || status === 'ready'
  const releaseUrl = latestVersion
    ? `https://github.com/${GITHUB_REPO}/releases/tag/v${latestVersion}`
    : `https://github.com/${GITHUB_REPO}/releases`

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h3 className="text-lg font-semibold text-[var(--mc-text-primary)]">Updates</h3>
        <p className="text-sm text-[var(--mc-text-muted)]">Manage MultiClaude updates</p>
      </div>

      {/* Divider */}
      <hr className="border-[var(--mc-border)]" />

      {/* VERSION Section */}
      <div className="space-y-4">
        <span className="text-xs font-semibold text-[var(--mc-text-muted)] uppercase tracking-wider">
          Version
        </span>

        <div className="flex items-center gap-2">
          <span className="text-3xl font-bold text-[var(--mc-text-primary)]">
            {currentVersion || '...'}
          </span>
          <button
            type="button"
            className="p-1 text-[var(--mc-text-muted)] hover:text-[var(--mc-text-secondary)] transition-colors"
            title="Current installed version"
          >
            <InfoIcon />
          </button>
        </div>

        {/* New Version Available Link */}
        {hasUpdate && latestVersion && (
          <a
            href={releaseUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-[var(--mc-accent)] hover:underline"
          >
            New version available: {latestVersion}
          </a>
        )}

        {/* Status: Up to date */}
        {status === 'idle' && !latestVersion && (
          <p className="text-sm text-[var(--mc-text-muted)]">You&apos;re running the latest version</p>
        )}

        {/* Status: Error */}
        {status === 'error' && error && (
          <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-md">
            <p className="text-sm text-red-500">{error}</p>
          </div>
        )}
      </div>

      {/* Release Notes */}
      {hasUpdate && releaseNotes && (
        <div className="border-l-4 border-[var(--mc-accent)] bg-[var(--mc-bg-tertiary)] rounded-r-md p-4 space-y-2">
          <span className="text-sm font-semibold text-[var(--mc-text-primary)]">
            ✨ What&apos;s New
          </span>
          <pre className="text-sm text-[var(--mc-text-secondary)] whitespace-pre-wrap max-h-40 overflow-y-auto">
            {releaseNotes}
          </pre>
        </div>
      )}

      {/* Download Progress */}
      {status === 'downloading' && (
        <div className="space-y-2">
          <div className="flex justify-between text-sm text-[var(--mc-text-muted)]">
            <span>Downloading...</span>
            <span>{downloadProgress}%</span>
          </div>
          <div className="h-2 bg-[var(--mc-bg-tertiary)] rounded-full overflow-hidden">
            <div
              className="h-full bg-[var(--mc-accent)] transition-all duration-300"
              style={{ width: `${downloadProgress}%` }}
            />
          </div>
        </div>
      )}

      {/* Action Buttons Row */}
      {hasUpdate && status !== 'downloading' && (
        <div className="flex flex-wrap items-center gap-3">
          <a
            href={releaseUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-[var(--mc-accent)] hover:underline flex items-center gap-1"
          >
            <ExternalLinkIcon />
            View full release on GitHub
          </a>

          {status === 'available' && (
            <button
              type="button"
              onClick={downloadUpdate}
              className="px-4 py-2 text-sm rounded-md bg-[var(--mc-accent)] text-[var(--mc-bg-primary)] hover:opacity-90 transition-opacity flex items-center gap-2"
            >
              <DownloadIcon />
              Download Update
            </button>
          )}

          {status === 'ready' && (
            <button
              type="button"
              onClick={installUpdate}
              className="px-4 py-2 text-sm rounded-md bg-[var(--mc-accent)] text-[var(--mc-bg-primary)] hover:opacity-90 transition-opacity flex items-center gap-2"
            >
              <InstallIcon />
              Install and Restart
            </button>
          )}
        </div>
      )}

      {/* Check for Updates Button */}
      <button
        type="button"
        onClick={checkForUpdates}
        disabled={status === 'checking' || status === 'downloading'}
        className={`
          w-full px-4 py-2.5 text-sm rounded-md flex items-center justify-center gap-2 transition-all
          ${status === 'checking' || status === 'downloading'
            ? 'bg-[var(--mc-bg-hover)] text-[var(--mc-text-muted)] cursor-not-allowed'
            : 'border border-[var(--mc-border)] text-[var(--mc-text-primary)] hover:bg-[var(--mc-bg-hover)]'
          }
        `}
      >
        <RefreshIcon spinning={status === 'checking'} />
        {status === 'checking' ? 'Checking for updates...' : 'Check for Updates'}
      </button>
    </div>
  )
}

// Icons
function InfoIcon() {
  return (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  )
}

function ExternalLinkIcon() {
  return (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
    </svg>
  )
}

function DownloadIcon() {
  return (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3 3m0 0l3-3m-3 3V10" />
    </svg>
  )
}

function InstallIcon() {
  return (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
    </svg>
  )
}

function RefreshIcon({ spinning = false }: { spinning?: boolean }) {
  return (
    <svg
      className={`w-4 h-4 ${spinning ? 'animate-spin' : ''}`}
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
    >
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
    </svg>
  )
}
