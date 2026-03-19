import { autoUpdater, UpdateInfo } from 'electron-updater'
import { BrowserWindow, app } from 'electron'
import { createWriteStream, existsSync, mkdirSync, renameSync, unlinkSync } from 'fs'
import { join } from 'path'
import { Readable, Transform } from 'stream'
import { pipeline } from 'stream/promises'
import { spawn } from 'child_process'
import type { UpdateState, UpdateStatus } from '@shared/types'
import { getUpdateInstallMode, pickMacDmgAsset, type GitHubReleaseAsset } from './mac-installer'

// Configure logging
autoUpdater.logger = console
autoUpdater.autoDownload = false
autoUpdater.autoInstallOnAppQuit = process.platform !== 'darwin'
// Enable prerelease updates when running a beta/alpha version
autoUpdater.allowPrerelease = true

let mainWindow: BrowserWindow | null = null
let isDevMode = false
const installMode = getUpdateInstallMode()
const isMacOS = installMode === 'open-installer'

// In-memory state
let updateState: UpdateState = {
  status: 'idle',
  currentVersion: app.getVersion(),
  latestVersion: null,
  releaseNotes: null,
  downloadProgress: 0,
  error: null,
  installMode
}

interface ReleaseMetadata {
  notes: string
  dmgAsset: GitHubReleaseAsset | null
}

// Release metadata cache (24hr TTL)
interface ReleaseMetadataCache extends ReleaseMetadata {
  version: string
  timestamp: number
}
let releaseMetadataCache: ReleaseMetadataCache | null = null
let downloadedMacInstallerPath: string | null = null
const CACHE_TTL = 24 * 60 * 60 * 1000 // 24 hours

function setStatus(status: UpdateStatus, extra?: Partial<UpdateState>) {
  updateState = { ...updateState, status, ...extra }
  broadcastState()
}

function broadcastState() {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('update:status-changed', updateState)
  }
}

export function getUpdateState(): UpdateState {
  return { ...updateState, currentVersion: app.getVersion() }
}

function clearPendingMacInstaller() {
  downloadedMacInstallerPath = null
}

async function fetchReleaseMetadata(version: string): Promise<ReleaseMetadata> {
  // Check cache
  if (releaseMetadataCache &&
      releaseMetadataCache.version === version &&
      Date.now() - releaseMetadataCache.timestamp < CACHE_TTL) {
    return {
      notes: releaseMetadataCache.notes,
      dmgAsset: releaseMetadataCache.dmgAsset
    }
  }

  try {
    const url = `https://api.github.com/repos/nguyennguyenit/MultiClaude/releases/tags/v${version}`
    const res = await fetch(url, {
      headers: { 'User-Agent': 'MultiClaude-Updater' }
    })

    if (!res.ok) {
      return {
        notes: 'No release notes available.',
        dmgAsset: null
      }
    }

    const data = await res.json() as {
      body?: string
      assets?: Array<{
        name?: string
        browser_download_url?: string
        size?: number
      }>
    }
    const notes = data.body || 'No release notes available.'
    const assets = Array.isArray(data.assets)
      ? data.assets
        .filter((asset): asset is Required<Pick<GitHubReleaseAsset, 'name' | 'browser_download_url'>> & Pick<GitHubReleaseAsset, 'size'> =>
          typeof asset.name === 'string' && typeof asset.browser_download_url === 'string')
        .map(asset => ({
          name: asset.name,
          browser_download_url: asset.browser_download_url,
          size: typeof asset.size === 'number' ? asset.size : undefined
        }))
      : []
    const dmgAsset = pickMacDmgAsset(assets)

    // Cache result
    releaseMetadataCache = {
      version,
      notes,
      dmgAsset,
      timestamp: Date.now()
    }

    return { notes, dmgAsset }
  } catch {
    return {
      notes: 'Failed to fetch release notes.',
      dmgAsset: null
    }
  }
}

async function downloadMacInstaller(version: string): Promise<void> {
  const { dmgAsset } = await fetchReleaseMetadata(version)

  if (!dmgAsset) {
    throw new Error('No macOS DMG installer found for this release. Please download it manually from GitHub Releases.')
  }

  clearPendingMacInstaller()

  const installersDir = join(app.getPath('userData'), 'updates')
  const installerPath = join(installersDir, dmgAsset.name)
  const tempInstallerPath = `${installerPath}.download`
  mkdirSync(installersDir, { recursive: true })

  try {
    unlinkSync(tempInstallerPath)
  } catch {
    // Ignore stale temp files from previous attempts.
  }

  const response = await fetch(dmgAsset.browser_download_url, {
    headers: { 'User-Agent': 'MultiClaude-Updater' }
  })

  if (!response.ok || !response.body) {
    throw new Error(`Failed to download macOS installer (${response.status} ${response.statusText})`)
  }

  const totalBytes = Number(response.headers.get('content-length') ?? dmgAsset.size ?? 0)
  let downloadedBytes = 0
  let lastProgress = 0

  const progressStream = new Transform({
    transform(chunk, _encoding, callback) {
      const chunkSize = Buffer.isBuffer(chunk) ? chunk.length : Buffer.byteLength(chunk)
      downloadedBytes += chunkSize

      if (totalBytes > 0) {
        const progress = Math.max(1, Math.min(99, Math.round((downloadedBytes / totalBytes) * 100)))
        if (progress !== lastProgress) {
          lastProgress = progress
          setStatus('downloading', { downloadProgress: progress })
        }
      }

      callback(null, chunk)
    }
  })

  try {
    await pipeline(
      Readable.fromWeb(response.body as Parameters<typeof Readable.fromWeb>[0]),
      progressStream,
      createWriteStream(tempInstallerPath)
    )

    if (existsSync(installerPath)) {
      unlinkSync(installerPath)
    }

    renameSync(tempInstallerPath, installerPath)
    downloadedMacInstallerPath = installerPath
    setStatus('ready', { downloadProgress: 100, error: null })
  } catch (error) {
    clearPendingMacInstaller()
    try {
      unlinkSync(tempInstallerPath)
    } catch {
      // Ignore failed temp cleanup.
    }
    throw error
  }
}

function installMacUpdate(): void {
  if (!downloadedMacInstallerPath || !existsSync(downloadedMacInstallerPath)) {
    clearPendingMacInstaller()
    setStatus('error', {
      error: 'Downloaded macOS installer not found. Please download the update again.'
    })
    return
  }

  const installerPath = downloadedMacInstallerPath

  app.once('will-quit', () => {
    try {
      const opener = spawn('/usr/bin/open', [installerPath], {
        detached: true,
        stdio: 'ignore'
      })
      opener.unref()
    } catch (error) {
      console.error('[AutoUpdater] Failed to open macOS installer:', error)
    }
  })

  app.quit()
}

async function checkWithRetry(retries: number, delayMs: number) {
  for (let i = 0; i < retries; i++) {
    try {
      await autoUpdater.checkForUpdates()
      return
    } catch (err) {
      const msg = (err as Error).message
      const isTransient = msg.includes('404') || msg.includes('ECONNRESET') || msg.includes('ETIMEDOUT')
      if (isTransient && i < retries - 1) {
        console.warn(`[AutoUpdater] Check failed (attempt ${i + 1}/${retries}), retrying in ${delayMs / 1000}s:`, msg)
        await new Promise(r => setTimeout(r, delayMs))
      } else {
        console.error('[AutoUpdater] Check failed:', msg)
      }
    }
  }
}

export function initAutoUpdater(window: BrowserWindow) {
  mainWindow = window

  // Skip in dev mode
  if (process.env.VITE_DEV_SERVER_URL) {
    console.log('[AutoUpdater] Skipping in development mode')
    isDevMode = true
    return
  }

  autoUpdater.on('checking-for-update', () => {
    console.log('[AutoUpdater] Checking for updates...')
    clearPendingMacInstaller()
    setStatus('checking', { error: null, downloadProgress: 0 })
  })

  autoUpdater.on('update-available', async (info: UpdateInfo) => {
    console.log('[AutoUpdater] Update available:', info.version)
    clearPendingMacInstaller()
    const { notes } = await fetchReleaseMetadata(info.version)
    setStatus('available', {
      latestVersion: info.version,
      releaseNotes: notes,
      error: null,
      downloadProgress: 0
    })
  })

  autoUpdater.on('update-not-available', () => {
    console.log('[AutoUpdater] No updates available')
    clearPendingMacInstaller()
    setStatus('up-to-date', {
      latestVersion: null,
      releaseNotes: null,
      downloadProgress: 0,
      error: null
    })
  })

  autoUpdater.on('download-progress', (progress) => {
    console.log(`[AutoUpdater] Download progress: ${progress.percent.toFixed(1)}%`)
    setStatus('downloading', {
      downloadProgress: Math.round(progress.percent)
    })
  })

  autoUpdater.on('update-downloaded', (info: UpdateInfo) => {
    console.log('[AutoUpdater] Update downloaded:', info.version)
    setStatus('ready', { downloadProgress: 100 })
  })

  autoUpdater.on('error', (error) => {
    console.error('[AutoUpdater] Error:', error.message)
    // Treat 404 (release assets not found) as "no update" instead of showing error to user
    if (error.message.includes('404') || error.message.includes('latest-mac.yml')) {
      setStatus('up-to-date', { error: null })
    } else if (
      error.message.includes('code failed to satisfy specified code requirement') ||
      error.message.includes('Code signature') ||
      error.message.includes('ShipIt')
    ) {
      // Ad-hoc signed builds: ShipIt validates the update against the running app's
      // Designated Requirement (DR). Old installs have hash-based DRs that reject any
      // new version. New builds include a stable DR — but until users reinstall, they
      // need to download manually once.
      setStatus('error', {
        error: 'Auto-install failed (code signature). Please download the new version manually from GitHub Releases.'
      })
    } else {
      setStatus('error', { error: error.message })
    }
  })

  // Auto-check after 3s delay with retry for transient failures
  setTimeout(() => {
    checkWithRetry(3, 10000)
  }, 3000)
}

export async function checkForUpdatesManually(): Promise<UpdateState> {
  // In dev mode, show appropriate message
  if (isDevMode) {
    setStatus('error', { error: 'Updates not available in development mode' })
    return getUpdateState()
  }

  try {
    setStatus('checking')
    await autoUpdater.checkForUpdates()
  } catch (error) {
    const msg = (error as Error).message
    if (msg.includes('404') || msg.includes('latest-mac.yml')) {
      setStatus('up-to-date', { error: null })
    } else {
      setStatus('error', { error: msg })
    }
  }
  return getUpdateState()
}

export async function downloadUpdate(): Promise<void> {
  setStatus('downloading', { downloadProgress: 0 })

  if (isMacOS) {
    if (!updateState.latestVersion) {
      setStatus('error', { error: 'Please check for updates again before downloading.' })
      return
    }

    try {
      await downloadMacInstaller(updateState.latestVersion)
    } catch (error) {
      setStatus('error', {
        error: (error as Error).message || 'Failed to download macOS installer.'
      })
      throw error
    }
    return
  }

  await autoUpdater.downloadUpdate()
}

export function installUpdate(): void {
  if (isMacOS) {
    installMacUpdate()
    return
  }

  // quitAndInstall closes all windows (triggering window-all-closed cleanup),
  // then installs the update. isSilent=false surfaces code signature errors
  // via the autoUpdater 'error' event instead of failing silently.
  autoUpdater.quitAndInstall(false, true)
}
