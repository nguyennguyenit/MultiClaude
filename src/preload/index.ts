import { contextBridge, ipcRenderer, webUtils, type IpcRendererEvent } from 'electron'
import { IPC_CHANNELS } from '@shared/constants'
import type {
  Terminal,
  Project,
  GitStatus,
  GitHubAuth,
  GitConfig,
  GitFileStatus,
  GitCommitResult,
  GitDiffResult,
  GitBranch,
  GitLogEntry,
  GitStashEntry,
  GitOperationResult,
  GitBranchDiff,
  AppSession,
  AppSettings,
  NotificationSettings,
  NotificationEvent,
  NotificationTestResult,
  GitHubIssue,
  GitHubPR,
  UpdateState,
  WslInfo,
  WindowsShell,
  WindowState,
  RemoteControlStatus
} from '@shared/types'

// Type-safe API for renderer
export interface ElectronAPI {
  terminal: {
    create: (options?: { cwd?: string; projectId?: string; shell?: WindowsShell }) => Promise<Terminal>
    destroy: (id: string) => Promise<boolean>
    write: (terminalId: string, data: string) => void
    resize: (terminalId: string, cols: number, rows: number) => void
    list: () => Promise<Terminal[]>
    invokeClaude: (terminalId: string, sessionId?: string) => Promise<boolean>
    detectWsl: () => Promise<WslInfo>
    onOutput: (callback: (data: { terminalId: string; data: string }) => void) => () => void
    onExit: (callback: (data: { terminalId: string; exitCode: number }) => void) => () => void
    onTitleChange: (callback: (data: { terminalId: string; title: string }) => void) => () => void
    onStateChange: (callback: (data: { terminalId: string; isClaudeMode: boolean }) => void) => () => void
    onCreated: (callback: (terminal: Terminal) => void) => () => void
    onAgentDetected: (callback: (data: { terminalId: string; agentType: string }) => void) => () => void
  }
  project: {
    list: () => Promise<Project[]>
    create: (project: { name: string; path: string }) => Promise<Project>
    update: (id: string, updates: Partial<Project>) => Promise<Project | null>
    delete: (id: string) => Promise<boolean>
    setActive: (id: string | null) => Promise<boolean>
    openFolder: () => Promise<string | null>
    checkFolder: (cwd: string) => Promise<{ exists: boolean; isEmpty: boolean; isGitRepo: boolean; fileCount: number }>
  }
  git: {
    status: (cwd: string) => Promise<GitStatus>
    init: (cwd: string) => Promise<boolean>
    addRemote: (cwd: string, url: string, name?: string) => Promise<boolean>
    push: (cwd: string, branch?: string, setUpstream?: boolean) => Promise<GitOperationResult>
    // Commit workflow methods
    fileStatus: (cwd: string) => Promise<GitFileStatus[]>
    stageFile: (cwd: string, file: string) => Promise<boolean>
    unstageFile: (cwd: string, file: string) => Promise<boolean>
    stageAll: (cwd: string) => Promise<boolean>
    commit: (cwd: string, message: string) => Promise<GitCommitResult>
    diff: (cwd: string, file?: string, staged?: boolean, oldFile?: string) => Promise<GitDiffResult>
    discard: (cwd: string, file: string) => Promise<boolean>
    // Extended operations
    pull: (cwd: string) => Promise<GitOperationResult>
    fetch: (cwd: string) => Promise<GitOperationResult>
    branches: (cwd: string) => Promise<GitBranch[]>
    createBranch: (cwd: string, name: string, checkout?: boolean) => Promise<GitOperationResult>
    checkoutBranch: (cwd: string, name: string) => Promise<GitOperationResult>
    deleteBranch: (cwd: string, name: string, force?: boolean) => Promise<GitOperationResult>
    merge: (cwd: string, branch: string) => Promise<GitOperationResult>
    log: (cwd: string, maxCount?: number) => Promise<GitLogEntry[]>
    stashList: (cwd: string) => Promise<GitStashEntry[]>
    stashSave: (cwd: string, message?: string) => Promise<GitOperationResult>
    stashApply: (cwd: string, index?: number) => Promise<GitOperationResult>
    stashPop: (cwd: string, index?: number) => Promise<GitOperationResult>
    stashDrop: (cwd: string, index?: number) => Promise<GitOperationResult>
    // Config methods
    configGet: () => Promise<GitConfig>
    configSet: (config: GitConfig) => Promise<GitOperationResult>
    // Branch diff comparison
    diffBranch: (cwd: string, baseBranch?: string) => Promise<GitBranchDiff>
    diffAgainstBranch: (cwd: string, file: string, baseBranch: string, oldFile?: string) => Promise<GitDiffResult>
    // Branch change event listener (from terminal git commands or file watcher)
    onBranchChanged: (callback: (data: { projectPath: string }) => void) => () => void
    // Watch project for external git changes
    watchProject: (projectPath: string) => Promise<boolean>
    unwatchProject: (projectPath: string) => Promise<boolean>
  }
  github: {
    authStatus: () => Promise<GitHubAuth>
    login: () => Promise<{ success: boolean; deviceCode?: string }>
    logout: () => Promise<GitOperationResult>
    createRepo: (name: string, isPrivate: boolean, cwd?: string) => Promise<{ success: boolean; url?: string; error?: string }>
    listIssues: (projectPath: string, state?: string) => Promise<{ success: boolean; data: GitHubIssue[]; error?: string }>
    listPRs: (projectPath: string, state?: string) => Promise<{ success: boolean; data: GitHubPR[]; error?: string }>
  }
  session: {
    save: (bounds?: { x: number; y: number; width: number; height: number }) => Promise<boolean>
    restore: () => Promise<AppSession | null>
  }
  app: {
    getPath: (name: string) => Promise<string>
    openExternal: (url: string) => void
  }
  notification: {
    getSettings: () => Promise<NotificationSettings>
    setSettings: (settings: Partial<NotificationSettings>) => Promise<NotificationSettings>
    getTelegram: () => Promise<{ botToken: string; chatId: string } | null>
    setTelegram: (botToken: string, chatId: string) => Promise<boolean>
    setDiscord: (webhookUrl: string) => Promise<boolean>
    getTelegramStatus: () => Promise<boolean>
    getDiscordStatus: () => Promise<boolean>
    testTelegram: (botToken: string, chatId: string) => Promise<NotificationTestResult>
    testDiscord: (webhookUrl: string) => Promise<NotificationTestResult>
    clearTelegram: () => Promise<boolean>
    clearDiscord: () => Promise<boolean>
    onEvent: (callback: (event: NotificationEvent) => void) => () => void
    setActiveTerminal: (terminalId: string | null) => void
    onRemoteControlStatus: (callback: (status: RemoteControlStatus) => void) => () => void
    getRemoteControlStatus: () => Promise<RemoteControlStatus>
  }
  yolo: {
    get: (projectPath: string) => Promise<boolean>
    set: (projectPath: string, enabled: boolean) => Promise<{ success: boolean; error?: string }>
  }
  clipboard: {
    saveImage: (base64Data: string) => Promise<string | null>
  }
  image: {
    open: (filePath: string) => Promise<boolean>
    delete: (filePath: string) => Promise<boolean>
    readBase64: (filePath: string) => Promise<string | null>
    listScreenshots: () => Promise<string[]>
  }
  filePicker: {
    open: () => Promise<string[] | null>
  }
  update: {
    getState: () => Promise<UpdateState>
    check: () => Promise<UpdateState>
    download: () => Promise<void>
    install: () => Promise<void>
    onStatusChanged: (callback: (state: UpdateState) => void) => () => void
  }
  /**
   * Settings API for app-wide preferences persistence.
   * Settings are stored via electron-store to disk.
   */
  settings: {
    /** Get current settings from disk. */
    get: () => Promise<AppSettings>
    /** Update settings with partial values. Returns updated settings. */
    set: (settings: Partial<AppSettings>) => Promise<AppSettings>
    /** Reset all settings to defaults. Returns default settings. */
    reset: () => Promise<AppSettings>
  }
  utils: {
    getFilePath: (file: File) => string
  }
  window: {
    updateTitleBarOverlay: (colors: { color: string; symbolColor: string }) => Promise<void>
    getState: () => Promise<WindowState>
    onStateChanged: (callback: (state: WindowState) => void) => () => void
    minimize: () => Promise<void>
    maximize: () => Promise<void>
    close: () => Promise<void>
  }
  onFileDrop: (callback: (filePath: string) => void) => () => void
}

const api: ElectronAPI = {
  terminal: {
    create: (options) => ipcRenderer.invoke(IPC_CHANNELS.TERMINAL_CREATE, options),
    destroy: (id) => ipcRenderer.invoke(IPC_CHANNELS.TERMINAL_DESTROY, id),
    write: (terminalId, data) => ipcRenderer.send(IPC_CHANNELS.TERMINAL_INPUT, { terminalId, data }),
    resize: (terminalId, cols, rows) => ipcRenderer.send(IPC_CHANNELS.TERMINAL_RESIZE, { terminalId, cols, rows }),
    list: () => ipcRenderer.invoke(IPC_CHANNELS.TERMINAL_LIST),
    invokeClaude: (terminalId, sessionId) => ipcRenderer.invoke(IPC_CHANNELS.TERMINAL_INVOKE_CLAUDE, { terminalId, sessionId }),
    detectWsl: () => ipcRenderer.invoke(IPC_CHANNELS.TERMINAL_DETECT_WSL),
    onOutput: (callback) => {
      const listener = (_: IpcRendererEvent, data: Parameters<typeof callback>[0]) => callback(data)
      ipcRenderer.on(IPC_CHANNELS.TERMINAL_OUTPUT, listener)
      return () => ipcRenderer.removeListener(IPC_CHANNELS.TERMINAL_OUTPUT, listener)
    },
    onExit: (callback) => {
      const listener = (_: IpcRendererEvent, data: Parameters<typeof callback>[0]) => callback(data)
      ipcRenderer.on('terminal:exit', listener)
      return () => ipcRenderer.removeListener('terminal:exit', listener)
    },
    onTitleChange: (callback) => {
      const listener = (_: IpcRendererEvent, data: Parameters<typeof callback>[0]) => callback(data)
      ipcRenderer.on(IPC_CHANNELS.TERMINAL_TITLE_CHANGE, listener)
      return () => ipcRenderer.removeListener(IPC_CHANNELS.TERMINAL_TITLE_CHANGE, listener)
    },
    onStateChange: (callback) => {
      const listener = (_: IpcRendererEvent, data: Parameters<typeof callback>[0]) => callback(data)
      ipcRenderer.on(IPC_CHANNELS.TERMINAL_STATE_CHANGE, listener)
      return () => ipcRenderer.removeListener(IPC_CHANNELS.TERMINAL_STATE_CHANGE, listener)
    },
    onCreated: (callback) => {
      const listener = (_: IpcRendererEvent, data: Parameters<typeof callback>[0]) => callback(data)
      ipcRenderer.on(IPC_CHANNELS.TERMINAL_CREATED, listener)
      return () => ipcRenderer.removeListener(IPC_CHANNELS.TERMINAL_CREATED, listener)
    },
    onAgentDetected: (callback) => {
      const listener = (_: IpcRendererEvent, data: Parameters<typeof callback>[0]) => callback(data)
      ipcRenderer.on(IPC_CHANNELS.TERMINAL_AGENT_DETECTED, listener)
      return () => ipcRenderer.removeListener(IPC_CHANNELS.TERMINAL_AGENT_DETECTED, listener)
    }
  },
  project: {
    list: () => ipcRenderer.invoke(IPC_CHANNELS.PROJECT_LIST),
    create: (project) => ipcRenderer.invoke(IPC_CHANNELS.PROJECT_CREATE, project),
    update: (id, updates) => ipcRenderer.invoke(IPC_CHANNELS.PROJECT_UPDATE, { id, updates }),
    delete: (id) => ipcRenderer.invoke(IPC_CHANNELS.PROJECT_DELETE, id),
    setActive: (id) => ipcRenderer.invoke(IPC_CHANNELS.PROJECT_SET_ACTIVE, id),
    openFolder: () => ipcRenderer.invoke(IPC_CHANNELS.PROJECT_OPEN_FOLDER),
    checkFolder: (cwd) => ipcRenderer.invoke(IPC_CHANNELS.PROJECT_CHECK_FOLDER, cwd)
  },
  git: {
    status: (cwd) => ipcRenderer.invoke(IPC_CHANNELS.GIT_STATUS, cwd),
    init: (cwd) => ipcRenderer.invoke(IPC_CHANNELS.GIT_INIT, cwd),
    addRemote: (cwd, url, name) => ipcRenderer.invoke(IPC_CHANNELS.GIT_ADD_REMOTE, { cwd, url, name }),
    push: (cwd, branch, setUpstream) => ipcRenderer.invoke(IPC_CHANNELS.GIT_PUSH, { cwd, branch, setUpstream }),
    // Commit workflow methods
    fileStatus: (cwd) => ipcRenderer.invoke(IPC_CHANNELS.GIT_FILE_STATUS, cwd),
    stageFile: (cwd, file) => ipcRenderer.invoke(IPC_CHANNELS.GIT_STAGE_FILE, { cwd, file }),
    unstageFile: (cwd, file) => ipcRenderer.invoke(IPC_CHANNELS.GIT_UNSTAGE_FILE, { cwd, file }),
    stageAll: (cwd) => ipcRenderer.invoke(IPC_CHANNELS.GIT_STAGE_ALL, cwd),
    commit: (cwd, message) => ipcRenderer.invoke(IPC_CHANNELS.GIT_COMMIT, { cwd, message }),
    diff: (cwd, file, staged, oldFile) => ipcRenderer.invoke(IPC_CHANNELS.GIT_DIFF, { cwd, file, staged, oldFile }),
    discard: (cwd, file) => ipcRenderer.invoke(IPC_CHANNELS.GIT_DISCARD, { cwd, file }),
    // Extended operations
    pull: (cwd) => ipcRenderer.invoke(IPC_CHANNELS.GIT_PULL, cwd),
    fetch: (cwd) => ipcRenderer.invoke(IPC_CHANNELS.GIT_FETCH, cwd),
    branches: (cwd) => ipcRenderer.invoke(IPC_CHANNELS.GIT_BRANCHES, cwd),
    createBranch: (cwd, name, checkout) => ipcRenderer.invoke(IPC_CHANNELS.GIT_CREATE_BRANCH, { cwd, name, checkout }),
    checkoutBranch: (cwd, name) => ipcRenderer.invoke(IPC_CHANNELS.GIT_CHECKOUT_BRANCH, { cwd, name }),
    deleteBranch: (cwd, name, force) => ipcRenderer.invoke(IPC_CHANNELS.GIT_DELETE_BRANCH, { cwd, name, force }),
    merge: (cwd, branch) => ipcRenderer.invoke(IPC_CHANNELS.GIT_MERGE, { cwd, branch }),
    log: (cwd, maxCount) => ipcRenderer.invoke(IPC_CHANNELS.GIT_LOG, { cwd, maxCount }),
    stashList: (cwd) => ipcRenderer.invoke(IPC_CHANNELS.GIT_STASH_LIST, cwd),
    stashSave: (cwd, message) => ipcRenderer.invoke(IPC_CHANNELS.GIT_STASH_SAVE, { cwd, message }),
    stashApply: (cwd, index) => ipcRenderer.invoke(IPC_CHANNELS.GIT_STASH_APPLY, { cwd, index }),
    stashPop: (cwd, index) => ipcRenderer.invoke(IPC_CHANNELS.GIT_STASH_POP, { cwd, index }),
    stashDrop: (cwd, index) => ipcRenderer.invoke(IPC_CHANNELS.GIT_STASH_DROP, { cwd, index }),
    // Config methods
    configGet: () => ipcRenderer.invoke(IPC_CHANNELS.GIT_CONFIG_GET),
    configSet: (config) => ipcRenderer.invoke(IPC_CHANNELS.GIT_CONFIG_SET, config),
    // Branch diff comparison
    diffBranch: (cwd, baseBranch) => ipcRenderer.invoke(IPC_CHANNELS.GIT_DIFF_BRANCH, { cwd, baseBranch }),
    diffAgainstBranch: (cwd, file, baseBranch, oldFile) => ipcRenderer.invoke(IPC_CHANNELS.GIT_DIFF_AGAINST_BRANCH, { cwd, file, baseBranch, oldFile }),
    // Branch change event listener (from terminal git commands or file watcher)
    onBranchChanged: (callback) => {
      const listener = (_: unknown, data: { projectPath: string }) => callback(data)
      ipcRenderer.on(IPC_CHANNELS.GIT_BRANCH_CHANGED, listener)
      return () => ipcRenderer.removeListener(IPC_CHANNELS.GIT_BRANCH_CHANGED, listener)
    },
    // Watch project for external git changes
    watchProject: (projectPath) => ipcRenderer.invoke(IPC_CHANNELS.GIT_WATCH_PROJECT, projectPath),
    unwatchProject: (projectPath) => ipcRenderer.invoke(IPC_CHANNELS.GIT_UNWATCH_PROJECT, projectPath)
  },
  github: {
    authStatus: () => ipcRenderer.invoke(IPC_CHANNELS.GITHUB_AUTH_STATUS),
    login: () => ipcRenderer.invoke(IPC_CHANNELS.GITHUB_LOGIN),
    logout: () => ipcRenderer.invoke(IPC_CHANNELS.GITHUB_LOGOUT),
    createRepo: (name, isPrivate, cwd) => ipcRenderer.invoke(IPC_CHANNELS.GITHUB_CREATE_REPO, { name, isPrivate, cwd }),
    listIssues: (projectPath, state = 'open') => ipcRenderer.invoke(IPC_CHANNELS.GITHUB_ISSUES_LIST, projectPath, state),
    listPRs: (projectPath, state = 'open') => ipcRenderer.invoke(IPC_CHANNELS.GITHUB_PRS_LIST, projectPath, state)
  },
  session: {
    save: (bounds) => ipcRenderer.invoke(IPC_CHANNELS.SESSION_SAVE, bounds),
    restore: () => ipcRenderer.invoke(IPC_CHANNELS.SESSION_RESTORE)
  },
  app: {
    getPath: (name) => ipcRenderer.invoke(IPC_CHANNELS.APP_GET_PATH, name),
    openExternal: (url) => ipcRenderer.send(IPC_CHANNELS.APP_OPEN_EXTERNAL, url)
  },
  notification: {
    getSettings: () => ipcRenderer.invoke(IPC_CHANNELS.NOTIFICATION_GET_SETTINGS),
    setSettings: (settings) => ipcRenderer.invoke(IPC_CHANNELS.NOTIFICATION_SET_SETTINGS, settings),
    getTelegram: () => ipcRenderer.invoke(IPC_CHANNELS.NOTIFICATION_GET_TELEGRAM),
    setTelegram: (botToken, chatId) => ipcRenderer.invoke(IPC_CHANNELS.NOTIFICATION_SET_TELEGRAM, { botToken, chatId }),
    setDiscord: (webhookUrl) => ipcRenderer.invoke(IPC_CHANNELS.NOTIFICATION_SET_DISCORD, { webhookUrl }),
    getTelegramStatus: () => ipcRenderer.invoke(IPC_CHANNELS.NOTIFICATION_GET_TELEGRAM_STATUS),
    getDiscordStatus: () => ipcRenderer.invoke(IPC_CHANNELS.NOTIFICATION_GET_DISCORD_STATUS),
    testTelegram: (botToken, chatId) => ipcRenderer.invoke(IPC_CHANNELS.NOTIFICATION_TEST_TELEGRAM, { botToken, chatId }),
    testDiscord: (webhookUrl) => ipcRenderer.invoke(IPC_CHANNELS.NOTIFICATION_TEST_DISCORD, { webhookUrl }),
    clearTelegram: () => ipcRenderer.invoke(IPC_CHANNELS.NOTIFICATION_CLEAR_TELEGRAM),
    clearDiscord: () => ipcRenderer.invoke(IPC_CHANNELS.NOTIFICATION_CLEAR_DISCORD),
    onEvent: (callback) => {
      const listener = (_: unknown, event: NotificationEvent) => callback(event)
      ipcRenderer.on(IPC_CHANNELS.NOTIFICATION_EVENT, listener)
      return () => ipcRenderer.removeListener(IPC_CHANNELS.NOTIFICATION_EVENT, listener)
    },
    setActiveTerminal: (terminalId: string | null) => {
      ipcRenderer.send(IPC_CHANNELS.NOTIFICATION_SET_ACTIVE_TERMINAL, terminalId)
    },
    onRemoteControlStatus: (callback: (status: import('@shared/types').RemoteControlStatus) => void) => {
      const handler = (_event: IpcRendererEvent, status: import('@shared/types').RemoteControlStatus) => callback(status)
      ipcRenderer.on(IPC_CHANNELS.NOTIFICATION_REMOTE_CONTROL_STATUS, handler)
      return () => ipcRenderer.removeListener(IPC_CHANNELS.NOTIFICATION_REMOTE_CONTROL_STATUS, handler)
    },
    getRemoteControlStatus: () => ipcRenderer.invoke(IPC_CHANNELS.NOTIFICATION_REMOTE_CONTROL_STATUS)
  },
  yolo: {
    get: (projectPath) => ipcRenderer.invoke(IPC_CHANNELS.YOLO_MODE_GET, projectPath),
    set: (projectPath, enabled) => ipcRenderer.invoke(IPC_CHANNELS.YOLO_MODE_SET, { projectPath, enabled })
  },
  clipboard: {
    saveImage: (base64Data: string) => ipcRenderer.invoke(IPC_CHANNELS.CLIPBOARD_SAVE_IMAGE, base64Data)
  },
  image: {
    open: (filePath: string) => ipcRenderer.invoke(IPC_CHANNELS.IMAGE_OPEN, filePath),
    delete: (filePath: string) => ipcRenderer.invoke(IPC_CHANNELS.IMAGE_DELETE, filePath),
    readBase64: (filePath: string) => ipcRenderer.invoke(IPC_CHANNELS.IMAGE_READ_BASE64, filePath),
    listScreenshots: () => ipcRenderer.invoke(IPC_CHANNELS.IMAGE_LIST_SCREENSHOTS)
  },
  filePicker: {
    open: () => ipcRenderer.invoke(IPC_CHANNELS.FILE_PICKER_OPEN)
  },
  update: {
    getState: () => ipcRenderer.invoke(IPC_CHANNELS.UPDATE_GET_STATE),
    check: () => ipcRenderer.invoke(IPC_CHANNELS.UPDATE_CHECK),
    download: () => ipcRenderer.invoke(IPC_CHANNELS.UPDATE_DOWNLOAD),
    install: () => ipcRenderer.invoke(IPC_CHANNELS.UPDATE_INSTALL),
    onStatusChanged: (callback) => {
      const listener = (_: unknown, state: UpdateState) => callback(state)
      ipcRenderer.on(IPC_CHANNELS.UPDATE_STATUS_CHANGED, listener)
      return () => ipcRenderer.removeListener(IPC_CHANNELS.UPDATE_STATUS_CHANGED, listener)
    }
  },
  settings: {
    get: () => ipcRenderer.invoke(IPC_CHANNELS.SETTINGS_GET),
    set: (settings) => ipcRenderer.invoke(IPC_CHANNELS.SETTINGS_SET, settings),
    reset: () => ipcRenderer.invoke(IPC_CHANNELS.SETTINGS_RESET)
  },
  utils: {
    getFilePath: (file) => webUtils.getPathForFile(file)
  },
  window: {
    updateTitleBarOverlay: (colors) => ipcRenderer.invoke('update-title-bar-overlay', colors),
    getState: () => ipcRenderer.invoke(IPC_CHANNELS.WINDOW_GET_STATE),
    onStateChanged: (callback) => {
      const listener = (_: unknown, state: WindowState) => callback(state)
      ipcRenderer.on(IPC_CHANNELS.WINDOW_STATE_CHANGED, listener)
      return () => ipcRenderer.removeListener(IPC_CHANNELS.WINDOW_STATE_CHANGED, listener)
    },
    minimize: () => ipcRenderer.invoke(IPC_CHANNELS.WINDOW_MINIMIZE),
    maximize: () => ipcRenderer.invoke(IPC_CHANNELS.WINDOW_MAXIMIZE),
    close: () => ipcRenderer.invoke(IPC_CHANNELS.WINDOW_CLOSE)
  },
  onFileDrop: (callback) => {
    const listener = (_: unknown, data: { filePath: string }) => callback(data.filePath)
    ipcRenderer.on('file-dropped', listener)
    return () => ipcRenderer.removeListener('file-dropped', listener)
  }
}

contextBridge.exposeInMainWorld('electron', api)

// Type declaration for renderer
declare global {
  interface Window {
    electron: ElectronAPI
  }
}
