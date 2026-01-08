import { BrowserWindow, Notification } from 'electron'
import { EventEmitter } from 'events'
import type { NotificationSettings, NotificationEventType, NotificationEvent } from '@shared/types'
import type { TaskEvent } from '@shared/types/notification-events'
import { DEFAULT_NOTIFICATION_SETTINGS, IPC_CHANNELS, TASK_TRACKER_CLEANUP_INTERVAL_MS } from '@shared/constants'
import { SecureStorage } from './secure-storage'
import { OutputParser } from './output-parser'
import { FocusDetector } from './focus-detector'
import { TaskTracker } from './task-tracker'
import { TelegramNotifier } from './telegram-notifier'
import { DiscordNotifier } from './discord-notifier'

export class NotificationManager extends EventEmitter {
  private settings: NotificationSettings
  private storage: SecureStorage
  private parser: OutputParser
  private focusDetector: FocusDetector
  private taskTracker: TaskTracker
  private window: BrowserWindow | null = null
  private cleanupInterval: NodeJS.Timeout | null = null

  // Map terminalId -> projectName for context
  private terminalProjects: Map<string, string> = new Map()

  constructor() {
    super()
    this.storage = new SecureStorage()
    this.parser = new OutputParser()
    this.focusDetector = new FocusDetector()
    this.taskTracker = new TaskTracker()

    this.settings = {
      ...DEFAULT_NOTIFICATION_SETTINGS,
      telegramConfigured: this.storage.hasTelegram(),
      discordConfigured: this.storage.hasDiscord()
    }

    // Listen for task events from parser
    this.parser.on('taskEvent', (event: TaskEvent) => {
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

  setActiveTerminal(terminalId: string | null): void {
    this.focusDetector.setActiveTerminal(terminalId)
  }

  setTerminalProject(terminalId: string, projectName: string): void {
    this.terminalProjects.set(terminalId, projectName)
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

    // Update parser mode if changed
    if (partial.outputMode) {
      this.parser.setMode(partial.outputMode)
    }

    return this.getSettings()
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
        notifier.sendTaskEvent(event).catch(console.error)
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
  setTelegram(botToken: string, chatId: string): void {
    this.storage.setTelegram(botToken, chatId)
  }

  clearTelegram(): void {
    this.storage.clearTelegram()
    this.settings.telegramEnabled = false
  }

  async testTelegram(botToken: string, chatId: string) {
    return TelegramNotifier.test(botToken, chatId)
  }

  // Discord methods
  setDiscord(webhookUrl: string): void {
    this.storage.setDiscord(webhookUrl)
  }

  clearDiscord(): void {
    this.storage.clearDiscord()
    this.settings.discordEnabled = false
  }

  async testDiscord(webhookUrl: string) {
    return DiscordNotifier.test(webhookUrl)
  }

  // Cleanup
  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval)
    }
    this.focusDetector.destroy()
    this.taskTracker.clearAll()
    this.terminalProjects.clear()
  }
}
