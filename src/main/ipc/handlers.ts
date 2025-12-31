import { BrowserWindow, ipcMain, dialog, shell, app } from 'electron'
import { readdirSync } from 'fs'
import { IPC_CHANNELS } from '@shared/constants'
import type { TerminalManager } from '../terminal/terminal-manager'
import type { GitManager } from '../git/git-manager'
import type { ProjectStore } from '../project/project-store'
import type { NotificationManager } from '../notification'

interface Managers {
  terminalManager: TerminalManager
  gitManager: GitManager
  projectStore: ProjectStore
  notificationManager: NotificationManager
}

export function registerIpcHandlers(window: BrowserWindow, managers: Managers) {
  const { terminalManager, gitManager, projectStore, notificationManager } = managers

  // Forward terminal output to renderer + notification detection
  terminalManager.on('output', ({ terminalId, data }) => {
    if (!window.isDestroyed()) {
      window.webContents.send(IPC_CHANNELS.TERMINAL_OUTPUT, { terminalId, data })
    }
    // Pattern detection for notifications
    notificationManager.processOutput(terminalId, data)
  })

  terminalManager.on('exit', ({ terminalId, exitCode }) => {
    if (!window.isDestroyed()) {
      window.webContents.send('terminal:exit', { terminalId, exitCode })
    }
  })

  // Terminal handlers
  ipcMain.handle(IPC_CHANNELS.TERMINAL_CREATE, async (_, options) => {
    return terminalManager.create(options)
  })

  ipcMain.handle(IPC_CHANNELS.TERMINAL_DESTROY, async (_, id: string) => {
    return terminalManager.destroy(id)
  })

  ipcMain.on(IPC_CHANNELS.TERMINAL_INPUT, (_, { terminalId, data }) => {
    terminalManager.write(terminalId, data)
  })

  ipcMain.on(IPC_CHANNELS.TERMINAL_RESIZE, (_, { terminalId, cols, rows }) => {
    terminalManager.resize(terminalId, cols, rows)
  })

  ipcMain.handle(IPC_CHANNELS.TERMINAL_LIST, async () => {
    return terminalManager.list()
  })

  ipcMain.handle(IPC_CHANNELS.TERMINAL_INVOKE_CLAUDE, async (_, { terminalId, sessionId }) => {
    return terminalManager.invokeClaudeCode(terminalId, sessionId)
  })

  // Project handlers
  ipcMain.handle(IPC_CHANNELS.PROJECT_LIST, async () => {
    return projectStore.getProjects()
  })

  ipcMain.handle(IPC_CHANNELS.PROJECT_CREATE, async (_, project) => {
    return projectStore.addProject(project)
  })

  ipcMain.handle(IPC_CHANNELS.PROJECT_DELETE, async (_, id: string) => {
    return projectStore.deleteProject(id)
  })

  ipcMain.handle(IPC_CHANNELS.PROJECT_SET_ACTIVE, async (_, id: string | null) => {
    projectStore.setActiveProjectId(id)
    return true
  })

  ipcMain.handle(IPC_CHANNELS.PROJECT_OPEN_FOLDER, async () => {
    const result = await dialog.showOpenDialog(window, {
      properties: ['openDirectory']
    })
    if (result.canceled || result.filePaths.length === 0) {
      return null
    }
    return result.filePaths[0]
  })

  ipcMain.handle(IPC_CHANNELS.PROJECT_CHECK_FOLDER, async (_, cwd: string) => {
    try {
      const files = readdirSync(cwd)
      // Filter out hidden files (starting with .)
      const visibleFiles = files.filter(f => !f.startsWith('.'))
      const isEmpty = visibleFiles.length === 0
      const gitStatus = await gitManager.getStatus(cwd)
      return {
        isEmpty,
        isGitRepo: gitStatus.isRepo,
        fileCount: visibleFiles.length
      }
    } catch {
      return { isEmpty: true, isGitRepo: false, fileCount: 0 }
    }
  })

  // Git handlers
  ipcMain.handle(IPC_CHANNELS.GIT_STATUS, async (_, cwd: string) => {
    return gitManager.getStatus(cwd)
  })

  ipcMain.handle(IPC_CHANNELS.GIT_INIT, async (_, cwd: string) => {
    return gitManager.init(cwd)
  })

  ipcMain.handle(IPC_CHANNELS.GIT_ADD_REMOTE, async (_, { cwd, url, name }) => {
    return gitManager.addRemote(cwd, url, name)
  })

  ipcMain.handle(IPC_CHANNELS.GIT_PUSH, async (_, { cwd, branch, setUpstream }) => {
    return gitManager.push(cwd, branch, setUpstream)
  })

  // GitHub handlers
  ipcMain.handle(IPC_CHANNELS.GITHUB_AUTH_STATUS, async () => {
    return gitManager.getGitHubAuthStatus()
  })

  ipcMain.handle(IPC_CHANNELS.GITHUB_LOGIN, async () => {
    const result = await gitManager.loginGitHub()
    if (result.verificationUri) {
      shell.openExternal(result.verificationUri)
    }
    return result
  })

  ipcMain.handle(IPC_CHANNELS.GITHUB_CREATE_REPO, async (_, { name, isPrivate, cwd }) => {
    return gitManager.createGitHubRepo(name, isPrivate, cwd)
  })

  // Session handlers
  ipcMain.handle(IPC_CHANNELS.SESSION_SAVE, async (_, bounds) => {
    const sessions = terminalManager.getSessions()
    projectStore.saveSession({
      terminals: sessions,
      activeTerminalId: null,
      windowBounds: bounds
    })
    return true
  })

  ipcMain.handle(IPC_CHANNELS.SESSION_RESTORE, async () => {
    return projectStore.getSession()
  })

  // App handlers
  ipcMain.handle(IPC_CHANNELS.APP_GET_PATH, async (_, name: string) => {
    return app.getPath(name as any)
  })

  // Notification handlers
  ipcMain.handle(IPC_CHANNELS.NOTIFICATION_GET_SETTINGS, () => {
    return notificationManager.getSettings()
  })

  ipcMain.handle(IPC_CHANNELS.NOTIFICATION_SET_SETTINGS, (_, settings) => {
    return notificationManager.updateSettings(settings)
  })

  ipcMain.handle(IPC_CHANNELS.NOTIFICATION_SET_TELEGRAM, (_, { botToken, chatId }) => {
    notificationManager.setTelegram(botToken, chatId)
    return true
  })

  ipcMain.handle(IPC_CHANNELS.NOTIFICATION_SET_DISCORD, (_, { webhookUrl }) => {
    notificationManager.setDiscord(webhookUrl)
    return true
  })

  ipcMain.handle(IPC_CHANNELS.NOTIFICATION_GET_TELEGRAM_STATUS, () => {
    return notificationManager.getSettings().telegramConfigured
  })

  ipcMain.handle(IPC_CHANNELS.NOTIFICATION_GET_DISCORD_STATUS, () => {
    return notificationManager.getSettings().discordConfigured
  })

  ipcMain.handle(IPC_CHANNELS.NOTIFICATION_TEST_TELEGRAM, async (_, { botToken, chatId }) => {
    return notificationManager.testTelegram(botToken, chatId)
  })

  ipcMain.handle(IPC_CHANNELS.NOTIFICATION_TEST_DISCORD, async (_, { webhookUrl }) => {
    return notificationManager.testDiscord(webhookUrl)
  })

  ipcMain.handle(IPC_CHANNELS.NOTIFICATION_CLEAR_TELEGRAM, () => {
    notificationManager.clearTelegram()
    return true
  })

  ipcMain.handle(IPC_CHANNELS.NOTIFICATION_CLEAR_DISCORD, () => {
    notificationManager.clearDiscord()
    return true
  })
}
