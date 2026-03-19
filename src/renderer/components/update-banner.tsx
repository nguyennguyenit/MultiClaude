import { useState } from 'react'
import { useUpdateStore } from '../stores'

const GITHUB_REPO = 'nguyennguyenit/MultiClaude'

export function UpdateBanner() {
  const { state, downloadUpdate, installUpdate } = useUpdateStore()
  const { status, latestVersion, downloadProgress, error, installMode } = state
  const [dismissed, setDismissed] = useState(false)
  const isManualInstall = installMode === 'open-installer'

  const isCodeSignError = status === 'error' && !!error?.includes('GitHub Releases')

  if (dismissed) return null
  if (status !== 'available' && status !== 'downloading' && status !== 'ready' && !isCodeSignError) return null

  const releaseUrl = latestVersion
    ? `https://github.com/${GITHUB_REPO}/releases/tag/v${latestVersion}`
    : `https://github.com/${GITHUB_REPO}/releases`

  return (
    <div className="update-banner">
      {status === 'available' && (
        <>
          <span className="update-banner-icon">🔄</span>
          <span className="update-banner-text">
            {latestVersion ? `v${latestVersion} available` : 'Update available'}
          </span>
          <a
            className="update-banner-link"
            href={releaseUrl}
            target="_blank"
            rel="noreferrer"
          >
            Release Notes ↗
          </a>
          <button
            className="update-banner-btn"
            onClick={() => downloadUpdate()}
          >
            Download Update
          </button>
        </>
      )}

      {status === 'downloading' && (
        <>
          <span className="update-banner-icon">⬇️</span>
          <span className="update-banner-text">Downloading...</span>
          <div className="update-banner-progress">
            <div
              className="update-banner-progress-fill"
              style={{ width: `${downloadProgress ?? 0}%` }}
            />
          </div>
          <span className="update-banner-percent">{Math.round(downloadProgress ?? 0)}%</span>
        </>
      )}

      {status === 'ready' && (
        <>
          <span className="update-banner-icon">✅</span>
          <span className="update-banner-text">{isManualInstall ? 'Installer ready' : 'Update ready'}</span>
          <button
            className="update-banner-btn"
            onClick={() => installUpdate()}
          >
            {isManualInstall ? 'Install' : 'Install and Restart'}
          </button>
        </>
      )}

      {isCodeSignError && (
        <>
          <span className="update-banner-icon">⚠️</span>
          <span className="update-banner-text">Auto-install failed (code signature)</span>
          <a
            className="update-banner-link"
            href={releaseUrl}
            target="_blank"
            rel="noreferrer"
          >
            Download from GitHub ↗
          </a>
        </>
      )}

      {status !== 'ready' && (
        <button
          className="update-banner-dismiss"
          onClick={() => setDismissed(true)}
          title="Dismiss"
        >
          ×
        </button>
      )}
    </div>
  )
}
