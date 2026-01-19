import { BrowserWindow, ipcMain, dialog, shell, app } from 'electron'
import { readdirSync, existsSync, mkdirSync, writeFileSync, unlinkSync, readFileSync, statSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'
import { IPC_CHANNELS, DEFAULT_SETTINGS, isAllowedExternalUrl } from '@shared/constants'
import type { AppSettings } from '@shared/types'
import type { TerminalManager } from '../terminal/terminal-manager'
import type { GitManager } from '../git/git-manager'
import type { GitHeadWatcher } from '../git/git-head-watcher'
import type { ProjectStore } from '../project/project-store'
import type { SettingsStore } from '../settings'
import type { NotificationManager } from '../notification'
import { saveClipboardImage } from '../clipboard/clipboard-handler'
import { detectWsl } from '../terminal/wsl-detector'
import { checkForUpdatesManually, getUpdateState, downloadUpdate, installUpdate } from '../updater'

interface Managers {
  terminalManager: TerminalManager
  gitManager: GitManager
  gitHeadWatcher: GitHeadWatcher
  projectStore: ProjectStore
  settingsStore: SettingsStore
  notificationManager: NotificationManager
}

// Pattern to detect git branch changes from terminal output
// Matches: "Switched to branch 'xxx'", "Switched to a new branch 'xxx'", "Already on 'xxx'"
const GIT_BRANCH_CHANGE_PATTERN = /Switched to (?:a new )?branch '|Already on '/

export function registerIpcHandlers(window: BrowserWindow, managers: Managers) {
  const { terminalManager, gitManager, gitHeadWatcher, projectStore, settingsStore, notificationManager } = managers

  // Register git head watcher callback to emit branch changes from external terminals
  gitHeadWatcher.onBranchChange((projectPath) => {
    console.log(`[handlers] Git branch changed for ${projectPath}, sending IPC event`)
    if (!window.isDestroyed()) {
      window.webContents.send(IPC_CHANNELS.GIT_BRANCH_CHANGED, { projectPath })
    }
  })

  // Forward terminal output to renderer + notification detection
  terminalManager.on('output', ({ terminalId, data }) => {
    if (!window.isDestroyed()) {
      window.webContents.send(IPC_CHANNELS.TERMINAL_OUTPUT, { terminalId, data })
      // Detect git branch changes (from git checkout, git switch commands)
      if (GIT_BRANCH_CHANGE_PATTERN.test(data)) {
        const terminal = terminalManager.get(terminalId)
        if (terminal?.cwd) {
          window.webContents.send(IPC_CHANNELS.GIT_BRANCH_CHANGED, { projectPath: terminal.cwd })
        }
      }
    }
    // Pattern detection for notifications
    notificationManager.processOutput(terminalId, data)
  })

  terminalManager.on('exit', ({ terminalId, exitCode }) => {
    if (!window.isDestroyed()) {
      window.webContents.send('terminal:exit', { terminalId, exitCode })
    }
  })

  // Forward terminal title changes to renderer
  terminalManager.on('titleChange', ({ terminalId, title }) => {
    if (!window.isDestroyed()) {
      window.webContents.send(IPC_CHANNELS.TERMINAL_TITLE_CHANGE, { terminalId, title })
    }
  })

  // Terminal handlers
  ipcMain.handle(IPC_CHANNELS.TERMINAL_CREATE, async (_, options) => {
    const terminal = terminalManager.create(options)
    // Serialize Date to ISO string for IPC cloning
    return {
      ...terminal,
      createdAt: terminal.createdAt instanceof Date ? terminal.createdAt.toISOString() : terminal.createdAt
    }
  })

  ipcMain.handle(IPC_CHANNELS.TERMINAL_DESTROY, async (_, id: string) => {
    notificationManager.clearTerminal(id)
    return terminalManager.destroyAsync(id)
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

  // WSL detection handler (Windows only)
  // Returns null on non-Windows platforms so renderer can correctly identify platform
  ipcMain.handle(IPC_CHANNELS.TERMINAL_DETECT_WSL, async () => {
    if (process.platform !== 'win32') {
      return null
    }
    return detectWsl()
  })

  // Project handlers
  ipcMain.handle(IPC_CHANNELS.PROJECT_LIST, async () => {
    const projects = projectStore.getProjects()
    // Serialize Date fields for IPC cloning
    return projects.map(p => ({
      ...p,
      createdAt: p.createdAt instanceof Date ? p.createdAt.toISOString() : p.createdAt,
      updatedAt: p.updatedAt instanceof Date ? p.updatedAt.toISOString() : p.updatedAt
    }))
  })

  ipcMain.handle(IPC_CHANNELS.PROJECT_CREATE, async (_, project) => {
    const newProject = projectStore.addProject(project)
    // Serialize Date fields for IPC cloning
    return {
      ...newProject,
      createdAt: newProject.createdAt instanceof Date ? newProject.createdAt.toISOString() : newProject.createdAt,
      updatedAt: newProject.updatedAt instanceof Date ? newProject.updatedAt.toISOString() : newProject.updatedAt
    }
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
    // Check if folder exists first
    if (!existsSync(cwd)) {
      return { exists: false, isEmpty: true, isGitRepo: false, fileCount: 0 }
    }

    try {
      const files = readdirSync(cwd)
      // Filter out hidden files (starting with .)
      const visibleFiles = files.filter(f => !f.startsWith('.'))
      const isEmpty = visibleFiles.length === 0
      const gitStatus = await gitManager.getStatus(cwd)
      return {
        exists: true,
        isEmpty,
        isGitRepo: gitStatus.isRepo,
        fileCount: visibleFiles.length
      }
    } catch {
      return { exists: false, isEmpty: true, isGitRepo: false, fileCount: 0 }
    }
  })

  // Git handlers
  ipcMain.handle(IPC_CHANNELS.GIT_STATUS, async (_, cwd: string) => {
    return gitManager.getStatus(cwd)
  })

  // Git HEAD watcher handlers for external terminal changes
  ipcMain.handle(IPC_CHANNELS.GIT_WATCH_PROJECT, async (_, projectPath: string) => {
    console.log(`[handlers] Received watch request for ${projectPath}`)
    const result = gitHeadWatcher.watch(projectPath)
    console.log(`[handlers] Watch result: ${result}`)
    return result
  })

  ipcMain.handle(IPC_CHANNELS.GIT_UNWATCH_PROJECT, async (_, projectPath: string) => {
    console.log(`[handlers] Unwatching ${projectPath}`)
    gitHeadWatcher.unwatch(projectPath)
    return true
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

  // Git commit workflow handlers
  ipcMain.handle(IPC_CHANNELS.GIT_FILE_STATUS, async (_, cwd: string) => {
    return gitManager.getFileStatus(cwd)
  })

  ipcMain.handle(IPC_CHANNELS.GIT_STAGE_FILE, async (_, { cwd, file }: { cwd: string; file: string }) => {
    return gitManager.stageFile(cwd, file)
  })

  ipcMain.handle(IPC_CHANNELS.GIT_UNSTAGE_FILE, async (_, { cwd, file }: { cwd: string; file: string }) => {
    return gitManager.unstageFile(cwd, file)
  })

  ipcMain.handle(IPC_CHANNELS.GIT_STAGE_ALL, async (_, cwd: string) => {
    return gitManager.stageAll(cwd)
  })

  ipcMain.handle(IPC_CHANNELS.GIT_COMMIT, async (_, { cwd, message }: { cwd: string; message: string }) => {
    return gitManager.commit(cwd, message)
  })

  ipcMain.handle(IPC_CHANNELS.GIT_DIFF, async (_, { cwd, file, staged }: { cwd: string; file?: string; staged?: boolean }) => {
    return gitManager.getDiff(cwd, file, staged)
  })

  ipcMain.handle(IPC_CHANNELS.GIT_DISCARD, async (_, { cwd, file }: { cwd: string; file: string }) => {
    return gitManager.discardChanges(cwd, file)
  })

  // Git extended operations handlers
  ipcMain.handle(IPC_CHANNELS.GIT_PULL, async (_, cwd: string) => {
    return gitManager.pull(cwd)
  })

  ipcMain.handle(IPC_CHANNELS.GIT_FETCH, async (_, cwd: string) => {
    return gitManager.fetch(cwd)
  })

  ipcMain.handle(IPC_CHANNELS.GIT_BRANCHES, async (_, cwd: string) => {
    return gitManager.getBranches(cwd)
  })

  ipcMain.handle(IPC_CHANNELS.GIT_CREATE_BRANCH, async (_, { cwd, name, checkout }: { cwd: string; name: string; checkout?: boolean }) => {
    return gitManager.createBranch(cwd, name, checkout)
  })

  ipcMain.handle(IPC_CHANNELS.GIT_CHECKOUT_BRANCH, async (_, { cwd, name }: { cwd: string; name: string }) => {
    return gitManager.checkoutBranch(cwd, name)
  })

  ipcMain.handle(IPC_CHANNELS.GIT_DELETE_BRANCH, async (_, { cwd, name, force }: { cwd: string; name: string; force?: boolean }) => {
    return gitManager.deleteBranch(cwd, name, force)
  })

  ipcMain.handle(IPC_CHANNELS.GIT_MERGE, async (_, { cwd, branch }: { cwd: string; branch: string }) => {
    return gitManager.mergeBranch(cwd, branch)
  })

  ipcMain.handle(IPC_CHANNELS.GIT_LOG, async (_, { cwd, maxCount }: { cwd: string; maxCount?: number }) => {
    return gitManager.getLog(cwd, maxCount)
  })

  ipcMain.handle(IPC_CHANNELS.GIT_STASH_LIST, async (_, cwd: string) => {
    return gitManager.getStashList(cwd)
  })

  ipcMain.handle(IPC_CHANNELS.GIT_STASH_SAVE, async (_, { cwd, message }: { cwd: string; message?: string }) => {
    return gitManager.stashSave(cwd, message)
  })

  ipcMain.handle(IPC_CHANNELS.GIT_STASH_APPLY, async (_, { cwd, index }: { cwd: string; index?: number }) => {
    return gitManager.stashApply(cwd, index)
  })

  ipcMain.handle(IPC_CHANNELS.GIT_STASH_POP, async (_, { cwd, index }: { cwd: string; index?: number }) => {
    return gitManager.stashPop(cwd, index)
  })

  ipcMain.handle(IPC_CHANNELS.GIT_STASH_DROP, async (_, { cwd, index }: { cwd: string; index?: number }) => {
    return gitManager.stashDrop(cwd, index)
  })

  ipcMain.handle(IPC_CHANNELS.GIT_CONFIG_GET, async () => {
    return gitManager.getGitConfig()
  })

  ipcMain.handle(IPC_CHANNELS.GIT_CONFIG_SET, async (_, config: { userName?: string; userEmail?: string }) => {
    return gitManager.setGitConfig(config)
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

  ipcMain.handle(IPC_CHANNELS.GITHUB_LOGOUT, async () => {
    return gitManager.logoutGitHub()
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

  ipcMain.handle(IPC_CHANNELS.APP_CHECK_FOR_UPDATES, async () => {
    try {
      const result = await checkForUpdatesManually()
      return { success: true, updateState: result }
    } catch (error) {
      return { success: false, error: (error as Error).message }
    }
  })

  ipcMain.on(IPC_CHANNELS.APP_OPEN_EXTERNAL, (_, url: string) => {
    if (isAllowedExternalUrl(url)) {
      shell.openExternal(url)
    }
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

  // Active terminal tracking for background-only notifications
  // Uses ipcMain.on (not handle) for fire-and-forget - no response needed from renderer
  ipcMain.on(IPC_CHANNELS.NOTIFICATION_SET_ACTIVE_TERMINAL, (_, terminalId: string | null) => {
    notificationManager.setActiveTerminal(terminalId)
  })

  // YOLO Mode settings.local.json content
  const yoloSettingsContent = {
    permissions: {
      allow: [],
      deny: [
        "Bash(rm ~/)",
        "Bash(rm /)",
        "Bash(prisma db push)",
        "Bash(npx prisma db push)",
        "Bash(npm run db:push)",
        "Bash(bun run db:push)",
        "Bash(pnpm run db:push)",
        "Bash(rm -rf /:*)",
        "Bash(rm -rf ~:*)",
        "Bash(sudo rm -rf :*::*)",
        "Bash(dd if=/dev/zero of=/dev/sd*:*)",
        "Bash(mkfs.:*::*)",
        "Bash(fdisk:*)",
        "Bash(parted:*)",
        "Bash(chown -R /:*)",
        "Bash(chmod -R 0 /:*)",
        "Bash(shutdown:*)",
        "Bash(reboot:*)",
        "Bash(systemctl poweroff:*)",
        "Bash(git reset --hard:*)",
        "Bash(git clean -fdx:*)",
        "Bash(git push --force:*)",
        "Bash(docker system prune -af:*)",
        "Bash(docker volume rm -f :*::*)",
        "Bash(prisma migrate reset:*)"
      ],
      defaultMode: "bypassPermissions"
    }
  }

  // YOLO Mode handlers
  ipcMain.handle(IPC_CHANNELS.YOLO_MODE_GET, async (_, projectPath: string) => {
    const settingsPath = join(projectPath, '.claude', 'settings.local.json')
    return existsSync(settingsPath)
  })

  ipcMain.handle(IPC_CHANNELS.YOLO_MODE_SET, async (_, { projectPath, enabled }: { projectPath: string; enabled: boolean }) => {
    const claudeDir = join(projectPath, '.claude')
    const settingsPath = join(claudeDir, 'settings.local.json')

    try {
      if (enabled) {
        // Create .claude directory if it doesn't exist
        if (!existsSync(claudeDir)) {
          mkdirSync(claudeDir, { recursive: true })
        }
        // Write settings.local.json
        writeFileSync(settingsPath, JSON.stringify(yoloSettingsContent, null, 2))
      } else {
        // Remove settings.local.json if it exists
        if (existsSync(settingsPath)) {
          unlinkSync(settingsPath)
        }
      }
      return { success: true }
    } catch (error) {
      return { success: false, error: (error as Error).message }
    }
  })

  // Clipboard handlers
  ipcMain.handle(IPC_CHANNELS.CLIPBOARD_SAVE_IMAGE, (_, base64Data: string) => {
    return saveClipboardImage(base64Data)
  })

  // Image handlers
  ipcMain.handle(IPC_CHANNELS.IMAGE_OPEN, (_, filePath: string) => {
    if (existsSync(filePath)) {
      shell.openPath(filePath)
      return true
    }
    return false
  })

  ipcMain.handle(IPC_CHANNELS.IMAGE_DELETE, (_, filePath: string) => {
    // Security: only allow deleting files in multiClaude-screenshots directory
    if (existsSync(filePath) && filePath.includes('multiClaude-screenshots')) {
      try {
        unlinkSync(filePath)
        return true
      } catch {
        return false
      }
    }
    return false
  })

  ipcMain.handle(IPC_CHANNELS.IMAGE_READ_BASE64, (_, filePath: string) => {
    // Security: only allow reading files in multiClaude-screenshots directory
    if (existsSync(filePath) && filePath.includes('multiClaude-screenshots')) {
      try {
        const buffer = readFileSync(filePath)
        return buffer.toString('base64')
      } catch {
        return null
      }
    }
    return null
  })

  // List screenshot files sorted by modification time (newest first)
  ipcMain.handle(IPC_CHANNELS.IMAGE_LIST_SCREENSHOTS, () => {
    const screenshotDir = join(tmpdir(), 'multiClaude-screenshots')
    if (!existsSync(screenshotDir)) {
      return []
    }
    try {
      const files = readdirSync(screenshotDir)
        .filter(f => f.endsWith('.png'))
        .map(f => {
          const fullPath = join(screenshotDir, f)
          const stat = statSync(fullPath)
          return { path: fullPath, mtime: stat.mtimeMs }
        })
        .sort((a, b) => a.mtime - b.mtime) // oldest first (index 0 = Image #1)
        .map(f => f.path)
      return files
    } catch {
      return []
    }
  })

  // File picker handler
  ipcMain.handle(IPC_CHANNELS.FILE_PICKER_OPEN, async () => {
    const result = await dialog.showOpenDialog(window, {
      properties: ['openFile', 'multiSelections']
    })
    if (result.canceled || result.filePaths.length === 0) {
      return null
    }
    return result.filePaths
  })

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

  // Settings handlers
  ipcMain.handle(IPC_CHANNELS.SETTINGS_GET, () => {
    try {
      return settingsStore.getSettings()
    } catch (error) {
      console.error('[handlers] Failed to get settings:', error)
      // Fallback to defaults on catastrophic failure
      return DEFAULT_SETTINGS
    }
  })

  ipcMain.handle(IPC_CHANNELS.SETTINGS_SET, (_, settings: Partial<AppSettings>) => {
    try {
      // Basic validation: ensure settings is a non-null object and not an array
      if (!settings || typeof settings !== 'object' || Array.isArray(settings)) {
        throw new Error('Invalid settings: must be a non-array object')
      }
      return settingsStore.setSettings(settings)
    } catch (error) {
      console.error('[handlers] Failed to set settings:', error)
      throw error
    }
  })

  ipcMain.handle(IPC_CHANNELS.SETTINGS_RESET, () => {
    try {
      return settingsStore.resetSettings()
    } catch (error) {
      console.error('[handlers] Failed to reset settings:', error)
      throw error
    }
  })
}
