# Phase 2: Main Process Enhancements

## Context

Enhance auto-updater with state management and IPC communication, replacing native dialogs with events sent to renderer.

## Overview

Refactor auto-updater.ts to maintain update state, emit IPC events on state changes, fetch release notes from GitHub, and handle update IPC requests.

## Requirements

- Maintain in-memory UpdateState object
- Replace dialog.showMessageBox calls with IPC events
- Fetch release notes from GitHub Releases API with 1hr cache
- Register IPC handlers for all UPDATE_* channels
- Broadcast state changes to renderer via UPDATE_STATUS_CHANGED

## Architecture

```
src/main/
  updater/
    auto-updater.ts  <- MODIFY: state management, IPC events
  ipc/
    handlers.ts      <- MODIFY: register update handlers
```

## Implementation Steps

### 1. Modify `src/main/updater/auto-updater.ts`

Replace entire file with enhanced version:

```typescript
import { autoUpdater, UpdateInfo } from 'electron-updater'
import { BrowserWindow, app } from 'electron'
import type { UpdateState, UpdateStatus } from '@shared/types'

// Configure logging
autoUpdater.logger = console
autoUpdater.autoDownload = false
autoUpdater.autoInstallOnAppQuit = true

let mainWindow: BrowserWindow | null = null

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
    return
  }

  autoUpdater.on('checking-for-update', () => {
    console.log('[AutoUpdater] Checking for updates...')
    setStatus('checking')
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
  autoUpdater.quitAndInstall(false, true)
}
```

### 2. Modify `src/main/ipc/handlers.ts`

Add import at top:
```typescript
import { getUpdateState, checkForUpdatesManually, downloadUpdate, installUpdate } from '../updater'
```

Add handlers after FILE_PICKER_OPEN handler (before closing brace of registerIpcHandlers):
```typescript
// Update handlers
ipcMain.handle(IPC_CHANNELS.UPDATE_GET_STATE, () => {
  return getUpdateState()
})

ipcMain.handle(IPC_CHANNELS.UPDATE_CHECK, async () => {
  return checkForUpdatesManually()
})

ipcMain.handle(IPC_CHANNELS.UPDATE_DOWNLOAD, async () => {
  await downloadUpdate()
})

ipcMain.handle(IPC_CHANNELS.UPDATE_INSTALL, () => {
  installUpdate()
})
```

### 3. Export new functions from `src/main/updater/index.ts`

Verify index.ts exports match:
```typescript
export { initAutoUpdater, checkForUpdatesManually, getUpdateState, downloadUpdate, installUpdate } from './auto-updater'
```

## Todo

- [ ] Replace auto-updater.ts with state management version
- [ ] Add fetchReleaseNotes with caching
- [ ] Replace dialog calls with IPC broadcasts
- [ ] Export new functions: getUpdateState, downloadUpdate, installUpdate
- [ ] Add imports to handlers.ts
- [ ] Add UPDATE_* handlers to handlers.ts
- [ ] Update updater/index.ts exports
- [ ] Test in dev mode (should skip gracefully)

## Success Criteria

- [ ] getUpdateState() returns current UpdateState
- [ ] checkForUpdatesManually() triggers check and broadcasts state
- [ ] downloadUpdate() starts download with progress broadcasts
- [ ] installUpdate() triggers app restart
- [ ] No native dialogs appear during update flow
- [ ] Release notes cached for 1hr
- [ ] Error states properly set and broadcast
