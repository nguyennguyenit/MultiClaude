import { autoUpdater, UpdateInfo } from 'electron-updater'
import { BrowserWindow, app } from 'electron'
import type { UpdateState, UpdateStatus } from '@shared/types'

// Configure logging
autoUpdater.logger = console
autoUpdater.autoDownload = false
autoUpdater.autoInstallOnAppQuit = true
// Enable prerelease updates when running a beta/alpha version
autoUpdater.allowPrerelease = true

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
    setStatus('up-to-date', { error: null })
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
    if (error.message.includes('404')) {
      setStatus('idle', { error: null })
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
