import { autoUpdater, UpdateInfo } from 'electron-updater'
import { dialog, BrowserWindow } from 'electron'

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
    // Send to renderer for UI display
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
