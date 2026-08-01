import { app, BrowserWindow, dialog, ipcMain, powerMonitor } from 'electron'
import path from 'path'
import { fileURLToPath } from 'url'
import { TerminalManager } from './terminal/terminal-manager'
import { GitManager } from './git/git-manager'
import { GitHeadWatcher } from './git/git-head-watcher'
import { ProjectStore } from './project/project-store'
import { SettingsStore } from './settings'
import { NotificationManager } from './notification'
import { ContextWindowAnalyzer } from './context'
import { registerContextHandlers } from './ipc/context-handlers'
import { registerIpcHandlers } from './ipc/handlers'
import { registerGitHubHandlers } from './ipc/github-handlers'
import { registerAgentHandlers } from './ipc/agent-handlers'
import { AgentRegistry } from './agent/agent-registry'
import { ClaudeAdapter } from './agent/providers/claude-adapter'
import { CodexAdapter } from './agent/providers/codex-adapter'
import { CodexAppServerClient } from './agent/providers/codex-app-server-client'
import { AgentInsightsService } from './agent-insights/agent-insights-service'
import { registerAgentInsightsHandlers } from './ipc/agent-insights-handlers'
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
let settingsStore: SettingsStore | null = null
let notificationManager: NotificationManager | null = null
let contextAnalyzer: ContextWindowAnalyzer | null = null
let agentRegistry: AgentRegistry | null = null
let unregisterAgentHandlers: (() => void) | null = null
let agentInsightsService: AgentInsightsService | null = null
let unregisterAgentInsightsHandlers: (() => void) | null = null

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
  terminalManager.setSettings(settingsStore.getSettings())
  notificationManager = new NotificationManager()
  notificationManager.setWindow(mainWindow)
  agentRegistry = new AgentRegistry([
    new ClaudeAdapter({
      runtime: terminalManager,
      source: notificationManager.getLogWatcher(),
    }),
    new CodexAdapter(new CodexAppServerClient()),
  ])
  unregisterAgentHandlers?.()
  unregisterAgentHandlers = registerAgentHandlers(
    agentRegistry,
    (terminalId, webContentsId) => {
      if (mainWindow?.webContents.id !== webContentsId) return undefined
      const terminal = terminalManager?.get(terminalId)
      return terminal ? { cwd: terminal.cwd, projectId: terminal.projectId } : undefined
    }
  )
  agentInsightsService = new AgentInsightsService(agentRegistry, {
    advancedEnabled: Boolean(settingsStore.getSettings().enableContextWindowAdvanced),
  })
  unregisterAgentInsightsHandlers?.()
  unregisterAgentInsightsHandlers = registerAgentInsightsHandlers(agentInsightsService, agentRegistry)
  terminalManager.on('exit', ({ terminalId }: { terminalId: string }) => {
    void agentRegistry?.detach(terminalId, { dispose: true }).catch(error => {
      console.warn('[agent-registry] Failed to detach exited terminal:', (error as Error).message)
    })
  })

  // Context window analyzer (piggybacks on existing JSONL watcher).
  // Gated by AppSettings.enableContextWindow (startup-only; restart to toggle).
  const contextSettings = settingsStore.getSettings()
  if (contextSettings.enableContextWindow !== false) {
    contextAnalyzer = new ContextWindowAnalyzer(
      notificationManager.getLogWatcher(),
      undefined,
      { advancedEnabled: Boolean(contextSettings.enableContextWindowAdvanced) }
    )
    contextAnalyzer.on('error', (err) => {
      console.warn('[context-analyzer]', err)
    })
    registerContextHandlers(contextAnalyzer)
  }

  // Kick off shell detection in the background (C3: stored as promise, no await needed)
  terminalManager.initializeShells()

  // Register IPC handlers
  registerIpcHandlers(mainWindow, {
    terminalManager,
    gitManager,
    gitHeadWatcher,
    projectStore,
    settingsStore,
    notificationManager,
    agentRegistry
  })

  // Register GitHub-specific handlers
  registerGitHubHandlers(ipcMain)

  // Initialize auto-updater
  initAutoUpdater(mainWindow)

  // Load the app
  mainWindow.webContents.once('did-finish-load', () => {
    settingsStore?.markMigrationHealthy()
  })
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
    unregisterAgentInsightsHandlers?.()
    unregisterAgentInsightsHandlers = null
    agentInsightsService?.destroy()
    agentInsightsService = null
    unregisterAgentHandlers?.()
    unregisterAgentHandlers = null
    void agentRegistry?.dispose()
    agentRegistry = null
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
  contextAnalyzer?.destroy()
  notificationManager?.destroy()
  unregisterAgentInsightsHandlers?.()
  unregisterAgentInsightsHandlers = null
  agentInsightsService?.destroy()
  agentInsightsService = null
  unregisterAgentHandlers?.()
  unregisterAgentHandlers = null
  await agentRegistry?.dispose()
  agentRegistry = null

  // Production macOS apps stay resident after their final window closes.
  // Isolated Electron E2E instances must exit so the next test can launch
  // without inheriting a live background process.
  if (process.platform !== 'darwin' || process.argv.includes('--e2e')) {
    app.quit()
  }
})

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error)
  // Don't show dialog for PTY-related errors during suspend/resume
  // These are expected when system wakes and FDs become invalid.
  // "write EOF" / "write after end" fire async from node-pty stream when an
  // IPC input/resize lands between pty.kill() and the onExit event — the
  // terminal is gone but the error escapes try/catch because the underlying
  // socket.write is async.
  const msg = error.message ?? ''
  if (
    msg.includes('pty') ||
    msg.includes('EIO') ||
    msg.includes('write EOF') ||
    msg.includes('write after end') ||
    msg.includes('EPIPE')
  ) {
    console.warn('[main] PTY error ignored (closed stream or suspend/resume):', msg)
    return
  }
  dialog.showErrorBox('Error', error.message)
})

// Handle unhandled promise rejections (often from native modules)
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason)
})
