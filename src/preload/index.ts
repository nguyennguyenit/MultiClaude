import { contextBridge, ipcRenderer, webUtils } from 'electron'
import { IPC_CHANNELS } from '@shared/constants'
import type { Terminal, Project, GitStatus, GitHubAuth, AppSession, NotificationSettings, NotificationEvent, NotificationTestResult } from '@shared/types'

// Type-safe API for renderer
export interface ElectronAPI {
  terminal: {
    create: (options?: { cwd?: string; projectId?: string }) => Promise<Terminal>
    destroy: (id: string) => Promise<boolean>
    write: (terminalId: string, data: string) => void
    resize: (terminalId: string, cols: number, rows: number) => void
    list: () => Promise<Terminal[]>
    invokeClaude: (terminalId: string, sessionId?: string) => Promise<boolean>
    onOutput: (callback: (data: { terminalId: string; data: string }) => void) => () => void
    onExit: (callback: (data: { terminalId: string; exitCode: number }) => void) => () => void
    onTitleChange: (callback: (data: { terminalId: string; title: string }) => void) => () => void
  }
  project: {
    list: () => Promise<Project[]>
    create: (project: { name: string; path: string }) => Promise<Project>
    delete: (id: string) => Promise<boolean>
    setActive: (id: string | null) => Promise<boolean>
    openFolder: () => Promise<string | null>
    checkFolder: (cwd: string) => Promise<{ isEmpty: boolean; isGitRepo: boolean; fileCount: number }>
  }
  git: {
    status: (cwd: string) => Promise<GitStatus>
    init: (cwd: string) => Promise<boolean>
    addRemote: (cwd: string, url: string, name?: string) => Promise<boolean>
    push: (cwd: string, branch?: string, setUpstream?: boolean) => Promise<boolean>
  }
  github: {
    authStatus: () => Promise<GitHubAuth>
    login: () => Promise<{ success: boolean; deviceCode?: string }>
    createRepo: (name: string, isPrivate: boolean, cwd?: string) => Promise<{ success: boolean; url?: string; error?: string }>
  }
  session: {
    save: (bounds?: { x: number; y: number; width: number; height: number }) => Promise<boolean>
    restore: () => Promise<AppSession | null>
  }
  app: {
    getPath: (name: string) => Promise<string>
  }
  notification: {
    getSettings: () => Promise<NotificationSettings>
    setSettings: (settings: Partial<NotificationSettings>) => Promise<NotificationSettings>
    setTelegram: (botToken: string, chatId: string) => Promise<boolean>
    setDiscord: (webhookUrl: string) => Promise<boolean>
    getTelegramStatus: () => Promise<boolean>
    getDiscordStatus: () => Promise<boolean>
    testTelegram: (botToken: string, chatId: string) => Promise<NotificationTestResult>
    testDiscord: (webhookUrl: string) => Promise<NotificationTestResult>
    clearTelegram: () => Promise<boolean>
    clearDiscord: () => Promise<boolean>
    onEvent: (callback: (event: NotificationEvent) => void) => () => void
  }
  yolo: {
    get: (projectPath: string) => Promise<boolean>
    set: (projectPath: string, enabled: boolean) => Promise<{ success: boolean; error?: string }>
  }
  clipboard: {
    saveImage: () => Promise<string | null>
  }
  utils: {
    getFilePath: (file: File) => string
  }
}

const api: ElectronAPI = {
  terminal: {
    create: (options) => ipcRenderer.invoke(IPC_CHANNELS.TERMINAL_CREATE, options),
    destroy: (id) => ipcRenderer.invoke(IPC_CHANNELS.TERMINAL_DESTROY, id),
    write: (terminalId, data) => ipcRenderer.send(IPC_CHANNELS.TERMINAL_INPUT, { terminalId, data }),
    resize: (terminalId, cols, rows) => ipcRenderer.send(IPC_CHANNELS.TERMINAL_RESIZE, { terminalId, cols, rows }),
    list: () => ipcRenderer.invoke(IPC_CHANNELS.TERMINAL_LIST),
    invokeClaude: (terminalId, sessionId) => ipcRenderer.invoke(IPC_CHANNELS.TERMINAL_INVOKE_CLAUDE, { terminalId, sessionId }),
    onOutput: (callback) => {
      const listener = (_: any, data: any) => callback(data)
      ipcRenderer.on(IPC_CHANNELS.TERMINAL_OUTPUT, listener)
      return () => ipcRenderer.removeListener(IPC_CHANNELS.TERMINAL_OUTPUT, listener)
    },
    onExit: (callback) => {
      const listener = (_: any, data: any) => callback(data)
      ipcRenderer.on('terminal:exit', listener)
      return () => ipcRenderer.removeListener('terminal:exit', listener)
    },
    onTitleChange: (callback) => {
      const listener = (_: any, data: any) => callback(data)
      ipcRenderer.on(IPC_CHANNELS.TERMINAL_TITLE_CHANGE, listener)
      return () => ipcRenderer.removeListener(IPC_CHANNELS.TERMINAL_TITLE_CHANGE, listener)
    }
  },
  project: {
    list: () => ipcRenderer.invoke(IPC_CHANNELS.PROJECT_LIST),
    create: (project) => ipcRenderer.invoke(IPC_CHANNELS.PROJECT_CREATE, project),
    delete: (id) => ipcRenderer.invoke(IPC_CHANNELS.PROJECT_DELETE, id),
    setActive: (id) => ipcRenderer.invoke(IPC_CHANNELS.PROJECT_SET_ACTIVE, id),
    openFolder: () => ipcRenderer.invoke(IPC_CHANNELS.PROJECT_OPEN_FOLDER),
    checkFolder: (cwd) => ipcRenderer.invoke(IPC_CHANNELS.PROJECT_CHECK_FOLDER, cwd)
  },
  git: {
    status: (cwd) => ipcRenderer.invoke(IPC_CHANNELS.GIT_STATUS, cwd),
    init: (cwd) => ipcRenderer.invoke(IPC_CHANNELS.GIT_INIT, cwd),
    addRemote: (cwd, url, name) => ipcRenderer.invoke(IPC_CHANNELS.GIT_ADD_REMOTE, { cwd, url, name }),
    push: (cwd, branch, setUpstream) => ipcRenderer.invoke(IPC_CHANNELS.GIT_PUSH, { cwd, branch, setUpstream })
  },
  github: {
    authStatus: () => ipcRenderer.invoke(IPC_CHANNELS.GITHUB_AUTH_STATUS),
    login: () => ipcRenderer.invoke(IPC_CHANNELS.GITHUB_LOGIN),
    createRepo: (name, isPrivate, cwd) => ipcRenderer.invoke(IPC_CHANNELS.GITHUB_CREATE_REPO, { name, isPrivate, cwd })
  },
  session: {
    save: (bounds) => ipcRenderer.invoke(IPC_CHANNELS.SESSION_SAVE, bounds),
    restore: () => ipcRenderer.invoke(IPC_CHANNELS.SESSION_RESTORE)
  },
  app: {
    getPath: (name) => ipcRenderer.invoke(IPC_CHANNELS.APP_GET_PATH, name)
  },
  notification: {
    getSettings: () => ipcRenderer.invoke(IPC_CHANNELS.NOTIFICATION_GET_SETTINGS),
    setSettings: (settings) => ipcRenderer.invoke(IPC_CHANNELS.NOTIFICATION_SET_SETTINGS, settings),
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
    }
  },
  yolo: {
    get: (projectPath) => ipcRenderer.invoke(IPC_CHANNELS.YOLO_MODE_GET, projectPath),
    set: (projectPath, enabled) => ipcRenderer.invoke(IPC_CHANNELS.YOLO_MODE_SET, { projectPath, enabled })
  },
  clipboard: {
    saveImage: () => ipcRenderer.invoke(IPC_CHANNELS.CLIPBOARD_SAVE_IMAGE)
  },
  utils: {
    getFilePath: (file) => webUtils.getPathForFile(file)
  }
}

contextBridge.exposeInMainWorld('electron', api)

// Type declaration for renderer
declare global {
  interface Window {
    electron: ElectronAPI
  }
}
