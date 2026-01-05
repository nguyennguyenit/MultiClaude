import { useEffect } from 'react'
import { useUpdateStore } from '../../stores'

export function UpdateSettings() {
  const { state, isLoading, loadState, checkForUpdates, downloadUpdate, installUpdate } = useUpdateStore()
  const { status, currentVersion, latestVersion, releaseNotes, downloadProgress, error } = state

  useEffect(() => {
    loadState()
  }, [loadState])

  return (
    <div className="space-y-4">
      {/* Current Version */}
      <div className="flex items-center justify-between">
        <span className="text-sm text-[var(--mc-text-secondary)]">Current Version</span>
        <span className="text-sm font-medium text-[var(--mc-text-primary)]">
          {currentVersion || 'Loading...'}
        </span>
      </div>

      {/* Check Button */}
      <button
        type="button"
        onClick={checkForUpdates}
        disabled={status === 'checking' || status === 'downloading'}
        className={`
          w-full px-3 py-2 text-sm rounded
          ${status === 'checking' || status === 'downloading'
            ? 'bg-[var(--mc-bg-hover)] text-[var(--mc-text-muted)] cursor-not-allowed'
            : 'bg-[var(--mc-accent)] text-[var(--mc-bg-primary)] hover:opacity-90'
          }
        `}
      >
        {status === 'checking' ? 'Checking...' : 'Check for Updates'}
      </button>

      {/* Status Messages */}
      {status === 'idle' && !latestVersion && (
        <p className="text-xs text-[var(--mc-text-muted)]">
          You're up to date.
        </p>
      )}

      {status === 'error' && error && (
        <p className="text-xs text-red-500">
          Error: {error}
        </p>
      )}

      {/* Update Available */}
      {(status === 'available' || status === 'downloading' || status === 'ready') && latestVersion && (
        <div className="border border-[var(--mc-border)] rounded p-3 space-y-3">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 bg-[var(--mc-accent)] rounded-full" />
            <span className="text-sm font-medium text-[var(--mc-text-primary)]">
              Version {latestVersion} available
            </span>
          </div>

          {/* Release Notes */}
          {releaseNotes && (
            <div className="space-y-1">
              <span className="text-xs text-[var(--mc-text-muted)]">What's New</span>
              <pre className="text-xs text-[var(--mc-text-secondary)] whitespace-pre-wrap max-h-32 overflow-y-auto bg-[var(--mc-bg-tertiary)] p-2 rounded">
                {releaseNotes}
              </pre>
            </div>
          )}

          {/* Download Progress */}
          {status === 'downloading' && (
            <div className="space-y-1">
              <div className="flex justify-between text-xs text-[var(--mc-text-muted)]">
                <span>Downloading...</span>
                <span>{downloadProgress}%</span>
              </div>
              <div className="h-2 bg-[var(--mc-bg-tertiary)] rounded overflow-hidden">
                <div
                  className="h-full bg-[var(--mc-accent)] transition-all duration-300"
                  style={{ width: `${downloadProgress}%` }}
                />
              </div>
            </div>
          )}

          {/* Action Button */}
          {status === 'available' && (
            <button
              type="button"
              onClick={downloadUpdate}
              className="w-full px-3 py-2 text-sm rounded bg-[var(--mc-accent)] text-[var(--mc-bg-primary)] hover:opacity-90"
            >
              Download Update
            </button>
          )}

          {status === 'ready' && (
            <button
              type="button"
              onClick={installUpdate}
              className="w-full px-3 py-2 text-sm rounded bg-[var(--mc-accent)] text-[var(--mc-bg-primary)] hover:opacity-90"
            >
              Install and Restart
            </button>
          )}
        </div>
      )}
    </div>
  )
}
