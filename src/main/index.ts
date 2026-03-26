import { app, BrowserWindow, dialog, ipcMain, powerMonitor } from 'electron'
import path from 'path'
import { fileURLToPath } from 'url'
import { TerminalManager } from './terminal/terminal-manager'
import { GitManager } from './git/git-manager'
import { GitHeadWatcher } from './git/git-head-watcher'
import { ProjectStore } from './project/project-store'
import { SettingsStore } from './settings'
import { NotificationManager } from './notification'
import { registerIpcHandlers } from './ipc/handlers'
import { registerGitHubHandlers } from './ipc/github-handlers'
import { initAutoUpdater } from './updater'
import { applyVietnameseImePatch, getClaudeVersion } from './vietnamese-ime-patcher'

// ES module compatibility for __dirname
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Singleton instances
let mainWindow: BrowserWindow | null = null
let terminalManager: TerminalManager | null = null
let gitManager: GitManager | null = null
let gitHeadWatcher: GitHeadWatcher | null = null
let projectStore: ProjectStore | null = null
let settingsStore: SettingsStore | null = null
let notificationManager: NotificationManager | null = null

// Vite dev server URL (injected by vite-plugin-electron)
const VITE_DEV_SERVER_URL = process.env['VITE_DEV_SERVER_URL']

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 800,
    minHeight: 600,
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false
    },
    titleBarStyle: 'hidden',
    backgroundColor: '#1e1e1e'
  })

  // Initialize managers
  terminalManager = new TerminalManager()
  gitManager = new GitManager()
  gitHeadWatcher = new GitHeadWatcher()
  projectStore = new ProjectStore()
  settingsStore = new SettingsStore()
  notificationManager = new NotificationManager()
  notificationManager.setWindow(mainWindow)

  // Register IPC handlers
  registerIpcHandlers(mainWindow, {
    terminalManager,
    gitManager,
    gitHeadWatcher,
    projectStore,
    settingsStore,
    notificationManager
  })

  // Register GitHub-specific handlers
  registerGitHubHandlers(ipcMain)

  // Initialize auto-updater
  initAutoUpdater(mainWindow)

  // Auto re-patch Vietnamese IME fix when Claude version changes
  try {
    const settings = settingsStore.getSettings()
    if (settings.vietnameseImeFix) {
      const currentVersion = getClaudeVersion()
      if (currentVersion && currentVersion !== settings.vietnameseImeClaudeVersion) {
        console.log(`[main] Claude version changed (${settings.vietnameseImeClaudeVersion} → ${currentVersion}), re-patching IME fix...`)
        const result = applyVietnameseImePatch(settings.vietnameseImeClaudePath || undefined)
        if (result.success) {
          settingsStore.setSettings({ vietnameseImeClaudeVersion: currentVersion })
          console.log('[main] Vietnamese IME fix re-applied successfully')
        } else {
          console.warn('[main] Vietnamese IME re-patch failed:', result.message)
        }
      }
    }
  } catch (err) {
    console.warn('[main] Vietnamese IME startup check failed:', err)
  }

  // Load the app
  if (VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(VITE_DEV_SERVER_URL)
    mainWindow.webContents.openDevTools()
  } else {
    mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'))
  }

  // Handle file drops - Electron on Linux may not fire DOM drag events
  // Intercept navigation attempts from file drops and send file paths via IPC
  mainWindow.webContents.on('will-navigate', (event, url) => {
    // Check if this is a file:// URL (file drop trying to navigate)
    if (url.startsWith('file://')) {
      event.preventDefault()
      const filePath = decodeURIComponent(url.replace('file://', ''))
      console.log('[main] File drop intercepted:', filePath)
      mainWindow?.webContents.send('file-dropped', { filePath })
    }
  })

  mainWindow.on('closed', () => {
    mainWindow = null
  })
}

app.whenReady().then(() => {
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })

  // Handle system power events to prevent SIGTRAP on suspend/resume
  // When system suspends, PTY file descriptors may become invalid
  powerMonitor.on('suspend', () => {
    console.log('[main] System suspending - preparing terminals for sleep')
    // Mark terminals as suspended to prevent operations during sleep
    if (terminalManager) {
      terminalManager.emit('system-suspend')
    }
    if (notificationManager) {
      notificationManager.emit('system-suspend')
    }
  })

  powerMonitor.on('resume', () => {
    console.log('[main] System resumed - checking terminal health')
    // Give system time to stabilize after wake, then notify terminals
    setTimeout(() => {
      if (terminalManager) {
        terminalManager.emit('system-resume')
      }
      if (notificationManager) {
        notificationManager.emit('system-resume')
      }
      // Notify renderer to refresh terminal connections if needed
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('system-resumed')
      }
    }, 1000)
  })
})

app.on('window-all-closed', async () => {
  // Cleanup terminals with proper process destruction
  if (terminalManager?.hasTerminals()) {
    await terminalManager.destroyAllAsync()
  }

  gitHeadWatcher?.destroy()
  notificationManager?.destroy()

  if (process.platform !== 'darwin') {
    app.quit()
  }
})

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error)
  // Don't show dialog for PTY-related errors during suspend/resume
  // These are expected when system wakes and FDs become invalid
  if (error.message?.includes('pty') || error.message?.includes('EIO')) {
    console.warn('[main] PTY error ignored (likely from suspend/resume):', error.message)
    return
  }
  dialog.showErrorBox('Error', error.message)
})

// Handle unhandled promise rejections (often from native modules)
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason)
})
