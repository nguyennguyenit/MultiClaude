import path from 'path'
import { BrowserWindow, Notification } from 'electron'
import { EventEmitter } from 'events'
import Store from 'electron-store'
import type { NotificationSettings, NotificationEventType, NotificationEvent } from '@shared/types'
import type { TaskEvent } from '@shared/types/notification-events'
import { DEFAULT_NOTIFICATION_SETTINGS, IPC_CHANNELS, TASK_TRACKER_CLEANUP_INTERVAL_MS } from '@shared/constants'
import { SecureStorage } from './secure-storage'
import { OutputParser } from './output-parser'
import { FocusDetector } from './focus-detector'
import { TaskTracker } from './task-tracker'
import { TelegramNotifier } from './telegram-notifier'
import { DiscordNotifier } from './discord-notifier'
import { TelegramPoller } from './telegram-poller'
import { TelegramCommandRouter } from './telegram-command-router'
import { ClaudeLogWatcher } from './claude-log-watcher'
import type { RemoteControlStatus } from '@shared/types'
import type { TerminalManager } from '../terminal/terminal-manager'
import type { ProjectStore } from '../project/project-store'

// Keys to persist (exclude computed fields like telegramConfigured/discordConfigured)
type PersistableKey = 'onTaskComplete' | 'onTaskFailed' | 'onReviewNeeded' |
  'soundEnabled' | 'soundPreset' | 'telegramEnabled' | 'discordEnabled' |
  'outputMode' | 'notifyOnlyBackground' | 'includeTaskSummary' | 'remoteControlEnabled'

const PERSISTABLE_KEYS: PersistableKey[] = [
  'onTaskComplete', 'onTaskFailed', 'onReviewNeeded',
  'soundEnabled', 'soundPreset', 'telegramEnabled', 'discordEnabled',
  'outputMode', 'notifyOnlyBackground', 'includeTaskSummary', 'remoteControlEnabled'
]

interface NotificationStoreSchema {
  notificationSettings: Partial<NotificationSettings>
}

export class NotificationManager extends EventEmitter {
  private settings: NotificationSettings
  private storage: SecureStorage
  private store: Store<NotificationStoreSchema>
  private parser: OutputParser
  private focusDetector: FocusDetector
  private taskTracker: TaskTracker
  private window: BrowserWindow | null = null
  private cleanupInterval: NodeJS.Timeout | null = null
  private logWatcher: ClaudeLogWatcher

  // Map terminalId -> projectName for context (used by OutputParser path)
  private terminalProjects: Map<string, string> = new Map()

  private poller: TelegramPoller | null = null
  private commandRouter: TelegramCommandRouter | null = null
  private terminalManagerRef: TerminalManager | null = null
  private projectStoreRef: ProjectStore | null = null
  private suspendHandler: (() => void) | null = null
  private resumeHandler: (() => void) | null = null

  constructor() {
    super()
    this.storage = new SecureStorage()
    this.store = new Store<NotificationStoreSchema>({
      name: 'multiclaude-notification-settings',
      defaults: { notificationSettings: {} }
    })
    this.parser = new OutputParser()
    this.focusDetector = new FocusDetector()
    this.taskTracker = new TaskTracker()
    this.logWatcher = new ClaudeLogWatcher()

    // Load persisted settings, merge with defaults and computed fields
    const persisted = this.store.get('notificationSettings', {})
    this.settings = {
      ...DEFAULT_NOTIFICATION_SETTINGS,
      ...persisted,
      telegramConfigured: this.storage.hasTelegram(),
      discordConfigured: this.storage.hasDiscord()
    }

    // Listen for task events from terminal output parser (reviewNeeded only)
    this.parser.on('taskEvent', (event: TaskEvent) => {
      this.handleTaskEvent(event)
    })

    // Listen for task completion events from JSONL transcript watcher
    // JSONL events use Claude session ID as terminalId — translate to real terminal ID
    this.logWatcher.on('taskEvent', (event: TaskEvent) => {
      const match = this.terminalManagerRef?.findByClaudeSessionId(event.terminalId)
      if (match) {
        event.terminalId = match.id
      }
      this.handleTaskEvent(event)
    })

    // Cleanup stale entries periodically
    this.cleanupInterval = setInterval(() => {
      this.parser.cleanup()
      this.taskTracker.cleanup()
    }, TASK_TRACKER_CLEANUP_INTERVAL_MS)
  }

  setWindow(window: BrowserWindow): void {
    this.window = window
    this.focusDetector.setWindow(window)
  }

  /** Store references to managers for remote control command routing */
  setManagers(terminalManager: TerminalManager, projectStore: ProjectStore): void {
    this.terminalManagerRef = terminalManager
    this.projectStoreRef = projectStore
  }

  setActiveTerminal(terminalId: string | null): void {
    this.focusDetector.setActiveTerminal(terminalId)
  }

  setTerminalProject(terminalId: string, projectName: string): void {
    this.terminalProjects.set(terminalId, projectName)
  }

  /**
   * Register the working directory for a terminal.
   * Starts watching ~/.claude/projects/<hash>/ for JSONL transcript events.
   * Call this when a terminal is created with a known CWD.
   */
  registerTerminalCwd(terminalId: string, cwd: string): void {
    this.logWatcher.register(cwd)
    this.setTerminalProject(terminalId, path.basename(cwd))
  }

  clearTerminal(terminalId: string): void {
    this.terminalProjects.delete(terminalId)
    this.taskTracker.clearTerminal(terminalId)
    this.parser.clearTerminal(terminalId)
  }

  getFocusDetector(): FocusDetector {
    return this.focusDetector
  }

  getTaskTracker(): TaskTracker {
    return this.taskTracker
  }

  getSettings(): NotificationSettings {
    return {
      ...this.settings,
      telegramConfigured: this.storage.hasTelegram(),
      discordConfigured: this.storage.hasDiscord()
    }
  }

  updateSettings(partial: Partial<NotificationSettings>): NotificationSettings {
    this.settings = { ...this.settings, ...partial }

    // Persist user-configurable fields to disk
    const toPersist: Partial<NotificationSettings> = {}
    for (const key of PERSISTABLE_KEYS) {
      if (key in this.settings) {
        (toPersist as Record<string, unknown>)[key] = this.settings[key]
      }
    }
    this.store.set('notificationSettings', toPersist)

    // Update parser mode if changed
    if (partial.outputMode) {
      this.parser.setMode(partial.outputMode)
    }

    // Sync remote control if relevant settings changed
    if (partial.remoteControlEnabled !== undefined ||
        partial.telegramEnabled !== undefined) {
      this.syncRemoteControl()
    }

    return this.getSettings()
  }

  /** Start or stop remote control based on settings */
  syncRemoteControl(): void {
    const settings = this.getSettings()

    if (settings.remoteControlEnabled && settings.telegramEnabled && settings.telegramConfigured) {
      this.startRemoteControl()
    } else {
      this.stopRemoteControl()
    }
  }

  private startRemoteControl(): void {
    if (this.poller) return // Already running

    const creds = this.storage.getTelegram()
    if (!creds || !this.terminalManagerRef || !this.projectStoreRef) return

    const notifier = new TelegramNotifier(creds.botToken, creds.chatId)
    this.commandRouter = new TelegramCommandRouter(
      this.terminalManagerRef,
      this.projectStoreRef,
      (text) => notifier.sendMarkdown(text)
    )

    // Register bot commands for Telegram autocomplete suggestions
    TelegramNotifier.registerBotCommands(creds.botToken).catch(console.error)

    this.poller = new TelegramPoller(creds.botToken, creds.chatId)
    this.poller.onMessage((text) => {
      this.commandRouter?.handle(text).catch(console.error)
    })
    this.poller.onCallback((callbackId, data) => {
      this.commandRouter?.handleCallback(callbackId, data).catch(console.error)
    })
    this.poller.onStatusChange((status) => {
      this.emitRemoteControlStatus(status)
    })

    // Listen for system suspend/resume
    this.suspendHandler = () => this.poller?.pause()
    this.resumeHandler = () => this.poller?.resume()
    this.on('system-suspend', this.suspendHandler)
    this.on('system-resume', this.resumeHandler)

    this.poller.start()
  }

  private stopRemoteControl(): void {
    if (!this.poller) return
    if (this.suspendHandler) this.off('system-suspend', this.suspendHandler)
    if (this.resumeHandler) this.off('system-resume', this.resumeHandler)
    this.suspendHandler = null
    this.resumeHandler = null
    this.poller.stop()
    this.poller = null
    this.commandRouter = null
    this.emitRemoteControlStatus('disconnected')
  }

  private emitRemoteControlStatus(status: RemoteControlStatus): void {
    if (this.window && !this.window.isDestroyed()) {
      this.window.webContents.send(IPC_CHANNELS.NOTIFICATION_REMOTE_CONTROL_STATUS, status)
    }
  }

  getRemoteControlStatus(): RemoteControlStatus {
    return this.poller ? this.poller.getStatus() : 'disconnected'
  }

  // Process terminal output through the parser
  processOutput(terminalId: string, output: string): void {
    const projectName = this.terminalProjects.get(terminalId) || 'Unknown'
    this.parser.parse(terminalId, output, projectName)
  }

  private handleTaskEvent(event: TaskEvent): void {
    const settings = this.getSettings()

    // Check if event type is enabled
    const eventEnabled =
      (event.type === 'taskComplete' && settings.onTaskComplete) ||
      (event.type === 'taskFailed' && settings.onTaskFailed) ||
      (event.type === 'reviewNeeded' && settings.onReviewNeeded)

    if (!eventEnabled) return

    // Check focus (if notifyOnlyBackground is enabled)
    if (settings.notifyOnlyBackground) {
      if (!this.focusDetector.shouldNotify(event.terminalId)) {
        return // User is watching this terminal
      }
    }

    // Check dedup
    if (!this.taskTracker.shouldNotify(event.terminalId, event.id)) {
      return // Already notified for this task
    }

    // Trigger notification
    this.triggerNotification(event)
  }

  private async triggerNotification(event: TaskEvent): Promise<void> {
    const settings = this.getSettings()

    // Build message
    const message = settings.includeTaskSummary
      ? `${event.projectName}: ${event.taskName}`
      : event.taskName

    // Legacy NotificationEvent for renderer (sound playback)
    const legacyEvent: NotificationEvent = {
      type: event.type,
      terminalId: event.terminalId,
      message,
      timestamp: event.timestamp
    }

    // Send to renderer for sound playback
    if (this.window && !this.window.isDestroyed()) {
      this.window.webContents.send(IPC_CHANNELS.NOTIFICATION_EVENT, legacyEvent)
    }

    // Show native notification
    this.showNativeNotification(event.type, message)

    // Send to external platforms with rich formatting
    await this.sendExternalNotifications(event)
  }

  private showNativeNotification(type: NotificationEventType, message: string): void {
    const titles: Record<NotificationEventType, string> = {
      taskComplete: '✅ Task Complete',
      taskFailed: '❌ Task Failed',
      reviewNeeded: '👀 Review Needed'
    }

    new Notification({
      title: titles[type],
      body: message.slice(0, 200)
    }).show()
  }

  private async sendExternalNotifications(event: TaskEvent): Promise<void> {
    const settings = this.getSettings()

    // Telegram with HTML formatting
    if (settings.telegramEnabled && settings.telegramConfigured) {
      const creds = this.storage.getTelegram()
      if (creds) {
        const notifier = new TelegramNotifier(creds.botToken, creds.chatId)
        const terminalTitle = this.terminalManagerRef?.get(event.terminalId)?.title
        notifier.sendTaskEvent(event, terminalTitle).catch(console.error)
      }
    }

    // Discord with rich embed
    if (settings.discordEnabled && settings.discordConfigured) {
      const webhookUrl = this.storage.getDiscord()
      if (webhookUrl) {
        const notifier = new DiscordNotifier(webhookUrl)
        notifier.sendTaskEvent(event).catch(console.error)
      }
    }
  }

  // Telegram methods
  getTelegramCredentials(): { botToken: string; chatId: string } | null {
    return this.storage.getTelegram()
  }

  setTelegram(botToken: string, chatId: string): void {
    this.storage.setTelegram(botToken, chatId)
    // Use updateSettings to persist telegramEnabled to disk and trigger syncRemoteControl
    this.updateSettings({ telegramEnabled: true })
  }

  clearTelegram(): void {
    this.storage.clearTelegram()
    // Use updateSettings to persist and trigger syncRemoteControl (stops poller)
    this.updateSettings({ telegramEnabled: false })
  }

  async testTelegram(botToken: string, chatId: string) {
    return TelegramNotifier.test(botToken, chatId)
  }

  // Discord methods
  setDiscord(webhookUrl: string): void {
    this.storage.setDiscord(webhookUrl)
    this.updateSettings({ discordEnabled: true })
  }

  clearDiscord(): void {
    this.storage.clearDiscord()
    this.updateSettings({ discordEnabled: false })
  }

  async testDiscord(webhookUrl: string) {
    return DiscordNotifier.test(webhookUrl)
  }

  // Cleanup
  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval)
    }
    this.stopRemoteControl()
    this.focusDetector.destroy()
    this.taskTracker.clearAll()
    this.terminalProjects.clear()
    this.logWatcher.destroy()
  }
}
