import { app, BrowserWindow, dialog, ipcMain } from 'electron'
import path from 'path'
import { fileURLToPath } from 'url'
import { TerminalManager } from './terminal/terminal-manager'
import { GitManager } from './git/git-manager'
import { GitHeadWatcher } from './git/git-head-watcher'
import { ProjectStore } from './project/project-store'
import { NotificationManager } from './notification'
import { registerIpcHandlers } from './ipc/handlers'
import { registerGitHubHandlers } from './ipc/github-handlers'
import { initAutoUpdater } from './updater'

// ES module compatibility for __dirname
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Singleton instances
let mainWindow: BrowserWindow | null = null
let terminalManager: TerminalManager | null = null
let gitManager: GitManager | null = null
let gitHeadWatcher: GitHeadWatcher | null = null
let projectStore: ProjectStore | null = null
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
    titleBarOverlay: {
      color: '#1e1e1e',
      symbolColor: '#d4d4d4',
      height: 40
    },
    backgroundColor: '#1e1e1e'
  })

  // Initialize managers
  terminalManager = new TerminalManager()
  gitManager = new GitManager()
  gitHeadWatcher = new GitHeadWatcher()
  projectStore = new ProjectStore()
  notificationManager = new NotificationManager()
  notificationManager.setWindow(mainWindow)

  // Register IPC handlers
  registerIpcHandlers(mainWindow, {
    terminalManager,
    gitManager,
    gitHeadWatcher,
    projectStore,
    notificationManager
  })

  // Register GitHub-specific handlers
  registerGitHubHandlers(ipcMain)

  // Initialize auto-updater
  initAutoUpdater(mainWindow)

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

  // Handle title bar overlay color updates from renderer
  ipcMain.handle('update-title-bar-overlay', (_event, colors: { color: string; symbolColor: string }) => {
    if (mainWindow) {
      mainWindow.setTitleBarOverlay({
        color: colors.color,
        symbolColor: colors.symbolColor,
        height: 40
      })
    }
  })
}

app.whenReady().then(() => {
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

app.on('window-all-closed', () => {
  // Cleanup
  terminalManager?.destroyAll()
  gitHeadWatcher?.destroy()
  notificationManager?.destroy()

  if (process.platform !== 'darwin') {
    app.quit()
  }
})

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error)
  dialog.showErrorBox('Error', error.message)
})
