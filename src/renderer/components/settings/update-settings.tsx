import { useEffect } from 'react'
import { useUpdateStore } from '../../stores'
import { SettingsTitle } from './settings-typography'

const GITHUB_REPO = 'nguyennguyenit/MultiClaude'

export function UpdateSettings() {
  const { state, loadState, checkForUpdates, downloadUpdate, installUpdate } = useUpdateStore()
  const { status, currentVersion, latestVersion, releaseNotes, downloadProgress, error, installMode } = state

  useEffect(() => {
    loadState()
  }, [loadState])

  const hasUpdate = status === 'available' || status === 'downloading' || status === 'ready'
  const isManualInstall = installMode === 'open-installer'
  const releaseUrl = latestVersion
    ? `https://github.com/${GITHUB_REPO}/releases/tag/v${latestVersion}`
    : `https://github.com/${GITHUB_REPO}/releases`

  return (
    <div className="flex flex-col gap-8 pb-16 max-w-2xl">
      <SettingsTitle description="Manage MultiClaude updates">Updates</SettingsTitle>

      {/* Current Version */}
      <div className="settings-card rounded-xl flex items-center justify-between">
        <div>
          <p className="text-base font-semibold text-[var(--mc-text-primary)]">Current Version</p>
          <p className="text-sm text-[var(--mc-text-muted)] mt-0.5">
            {hasUpdate && latestVersion
              ? <a href={releaseUrl} target="_blank" rel="noopener noreferrer" className="text-[var(--mc-accent)] hover:underline">New version available: {latestVersion}</a>
              : 'You\'re running the latest version'
            }
          </p>
        </div>
        <span className="text-2xl font-bold text-[var(--mc-text-primary)]">
          {currentVersion || '...'}
        </span>
      </div>

      {/* Error */}
      {status === 'error' && error && (
        <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-md flex flex-col gap-2">
          <p className="text-sm text-red-500">{error}</p>
          {error.includes('GitHub Releases') && (
            <a
              href={releaseUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-sm text-[var(--mc-accent)] hover:underline w-fit"
            >
              <ExternalLinkIcon />
              Download from GitHub Releases ↗
            </a>
          )}
        </div>
      )}

      {/* Release Notes */}
      {hasUpdate && releaseNotes && (
        <>
          <div className="settings-card rounded-xl flex flex-col gap-2">
            <p className="text-base font-semibold text-[var(--mc-text-primary)]">What&apos;s New</p>
            <pre className="text-sm text-[var(--mc-text-secondary)] whitespace-pre-wrap max-h-40 overflow-y-auto bg-[var(--mc-bg-secondary)] rounded-md p-3">
              {releaseNotes}
            </pre>
          </div>
        </>
      )}

      {/* Actions */}
      <div className="settings-card rounded-xl flex flex-col gap-3">
        <p className="text-base font-semibold text-[var(--mc-text-primary)]">Update Actions</p>
        <p className="text-sm text-[var(--mc-text-muted)] mt-0.5">
          {isManualInstall
            ? 'Check for updates, download the macOS installer, then open it to finish installation.'
            : 'Check for and install the latest version.'
          }
        </p>

        {/* Download Progress */}
        {status === 'downloading' && (
          <div className="flex flex-col gap-2">
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

        {status === 'ready' && isManualInstall && (
          <p className="text-sm text-[var(--mc-text-muted)]">
            MultiClaude will close and open the downloaded DMG so you can drag it into Applications.
          </p>
        )}

        <div className="flex flex-wrap items-center gap-3">
          {hasUpdate && status !== 'downloading' && (
            <>
              <a
                href={releaseUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-[var(--mc-accent)] hover:underline flex items-center gap-1"
              >
                <ExternalLinkIcon />
                View on GitHub
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
                  {isManualInstall ? 'Install Update' : 'Install and Restart'}
                </button>
              )}
            </>
          )}

          <button
            type="button"
            onClick={checkForUpdates}
            disabled={status === 'checking' || status === 'downloading'}
            className={`
              px-4 py-2 text-sm rounded-md flex items-center gap-2 transition-all border bg-[var(--mc-bg-hover)]
              ${status === 'checking' || status === 'downloading'
                ? 'border-[var(--mc-border)] text-[var(--mc-text-muted)] cursor-not-allowed'
                : 'border-[var(--mc-border)] text-[var(--mc-text-primary)] hover:bg-[var(--mc-bg-active)]'
              }
            `}
          >
            <RefreshIcon spinning={status === 'checking'} />
            {status === 'checking' ? 'Checking...' : 'Check for Updates'}
          </button>

          {status === 'up-to-date' && (
            <span className="text-sm text-green-500 flex items-center gap-1.5">
              <CheckIcon />
              You&apos;re on the latest version
            </span>
          )}
        </div>
      </div>
    </div>
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

function CheckIcon() {
  return (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
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
