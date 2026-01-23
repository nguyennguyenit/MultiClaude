import { autoUpdater, UpdateInfo } from 'electron-updater'
import { BrowserWindow, app } from 'electron'
import type { UpdateState, UpdateStatus } from '@shared/types'

// Configure logging
autoUpdater.logger = console
autoUpdater.autoDownload = false
autoUpdater.autoInstallOnAppQuit = true

let mainWindow: BrowserWindow | null = null
let isDevMode = false

// In-memory state
let updateState: UpdateState = {
  status: 'idle',
  currentVersion: app.getVersion(),
  latestVersion: null,
  releaseNotes: null,
  downloadProgress: 0,
  error: null
}

// Release notes cache (24hr TTL)
interface ReleaseNotesCache {
  version: string
  notes: string
  timestamp: number
}
let releaseNotesCache: ReleaseNotesCache | null = null
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

async function fetchReleaseNotes(version: string): Promise<string> {
  // Check cache
  if (releaseNotesCache &&
      releaseNotesCache.version === version &&
      Date.now() - releaseNotesCache.timestamp < CACHE_TTL) {
    return releaseNotesCache.notes
  }

  try {
    const url = `https://api.github.com/repos/nguyennguyenit/MultiClaude/releases/tags/v${version}`
    const res = await fetch(url, {
      headers: { 'User-Agent': 'MultiClaude-Updater' }
    })

    if (!res.ok) {
      return 'No release notes available.'
    }

    const data = await res.json()
    const notes = data.body || 'No release notes available.'

    // Cache result
    releaseNotesCache = { version, notes, timestamp: Date.now() }

    return notes
  } catch {
    return 'Failed to fetch release notes.'
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
    setStatus('checking', { error: null })
  })

  autoUpdater.on('update-available', async (info: UpdateInfo) => {
    console.log('[AutoUpdater] Update available:', info.version)
    const notes = await fetchReleaseNotes(info.version)
    setStatus('available', {
      latestVersion: info.version,
      releaseNotes: notes,
      error: null
    })
  })

  autoUpdater.on('update-not-available', () => {
    console.log('[AutoUpdater] No updates available')
    setStatus('idle', { error: null })
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
    setStatus('error', { error: error.message })
  })

  // Auto-check after 3s delay
  setTimeout(() => {
    autoUpdater.checkForUpdates().catch((err) => {
      console.error('[AutoUpdater] Check failed:', err.message)
    })
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
    setStatus('error', { error: (error as Error).message })
  }
  return getUpdateState()
}

export async function downloadUpdate(): Promise<void> {
  setStatus('downloading', { downloadProgress: 0 })
  await autoUpdater.downloadUpdate()
}

export function installUpdate(): void {
  // Use app.quit() instead of quitAndInstall() to trigger normal quit flow
  // This ensures terminal cleanup (destroyAllAsync) runs before exit
  // autoInstallOnAppQuit = true (line 8) handles update installation after quit
  app.quit()
}
