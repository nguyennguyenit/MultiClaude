# Phase 2: Implement Auto-Update in Main Process

**Status:** done (2026-01-03)
**Effort:** 1h

## Objective

Create auto-updater module and integrate into main process to check for updates on app startup.

## Tasks

### 2.1 Create auto-updater module

Create `src/main/updater/auto-updater.ts`:

```typescript
import { autoUpdater, UpdateInfo } from 'electron-updater'
import { app, dialog, BrowserWindow } from 'electron'

// Configure logging
autoUpdater.logger = console
autoUpdater.autoDownload = false // Let user decide
autoUpdater.autoInstallOnAppQuit = true

let mainWindow: BrowserWindow | null = null

export function initAutoUpdater(window: BrowserWindow) {
  mainWindow = window

  // Only check for updates in production
  if (process.env.VITE_DEV_SERVER_URL) {
    console.log('[AutoUpdater] Skipping update check in development mode')
    return
  }

  autoUpdater.on('checking-for-update', () => {
    console.log('[AutoUpdater] Checking for updates...')
  })

  autoUpdater.on('update-available', (info: UpdateInfo) => {
    console.log('[AutoUpdater] Update available:', info.version)
    promptUserForUpdate(info)
  })

  autoUpdater.on('update-not-available', () => {
    console.log('[AutoUpdater] No updates available')
  })

  autoUpdater.on('download-progress', (progress) => {
    console.log(`[AutoUpdater] Download progress: ${progress.percent.toFixed(1)}%`)
    // Optionally send to renderer for UI display
    mainWindow?.webContents.send('update-download-progress', progress)
  })

  autoUpdater.on('update-downloaded', (info: UpdateInfo) => {
    console.log('[AutoUpdater] Update downloaded:', info.version)
    promptInstallUpdate(info)
  })

  autoUpdater.on('error', (error) => {
    console.error('[AutoUpdater] Error:', error.message)
  })

  // Check for updates after a short delay
  setTimeout(() => {
    autoUpdater.checkForUpdates().catch((err) => {
      console.error('[AutoUpdater] Check failed:', err.message)
    })
  }, 3000)
}

async function promptUserForUpdate(info: UpdateInfo) {
  const result = await dialog.showMessageBox(mainWindow!, {
    type: 'info',
    title: 'Update Available',
    message: `Version ${info.version} is available`,
    detail: 'Would you like to download it now?',
    buttons: ['Download', 'Later'],
    defaultId: 0,
    cancelId: 1
  })

  if (result.response === 0) {
    autoUpdater.downloadUpdate()
  }
}

async function promptInstallUpdate(info: UpdateInfo) {
  const result = await dialog.showMessageBox(mainWindow!, {
    type: 'info',
    title: 'Update Ready',
    message: `Version ${info.version} is ready to install`,
    detail: 'The application will restart to apply the update.',
    buttons: ['Install Now', 'Later'],
    defaultId: 0,
    cancelId: 1
  })

  if (result.response === 0) {
    autoUpdater.quitAndInstall(false, true)
  }
}

export function checkForUpdatesManually() {
  return autoUpdater.checkForUpdates()
}
```

### 2.2 Create index export

Create `src/main/updater/index.ts`:

```typescript
export { initAutoUpdater, checkForUpdatesManually } from './auto-updater'
```

### 2.3 Integrate into main process

Modify `src/main/index.ts`:

```typescript
// Add import at top
import { initAutoUpdater } from './updater'

// In createWindow(), after mainWindow is created:
function createWindow() {
  mainWindow = new BrowserWindow({
    // ... existing config
  })

  // Initialize auto-updater
  initAutoUpdater(mainWindow)

  // ... rest of existing code
}
```

### 2.4 Add IPC handler for manual update check (optional)

In `src/main/ipc/handlers.ts`, add:

```typescript
import { checkForUpdatesManually } from '../updater'

// Add to registerIpcHandlers:
ipcMain.handle('app:check-for-updates', async () => {
  try {
    const result = await checkForUpdatesManually()
    return { success: true, updateInfo: result?.updateInfo }
  } catch (error) {
    return { success: false, error: (error as Error).message }
  }
})
```

## Verification

- [ ] `src/main/updater/auto-updater.ts` created
- [ ] `src/main/updater/index.ts` created
- [ ] Main process imports and calls `initAutoUpdater`
- [ ] `npm run build` succeeds
- [ ] App starts without errors (in dev mode, updater is skipped)

## Notes

- `autoDownload: false` - respects user choice, doesn't download automatically
- `autoInstallOnAppQuit: true` - if downloaded, installs on next restart
- 3 second delay before check prevents startup slowdown
- Development mode skips update check entirely
