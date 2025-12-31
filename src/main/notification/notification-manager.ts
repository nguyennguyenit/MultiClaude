import { BrowserWindow, Notification } from 'electron'
import { EventEmitter } from 'events'
import type { NotificationSettings, NotificationEventType, NotificationEvent } from '@shared/types'
import { DEFAULT_NOTIFICATION_SETTINGS, IPC_CHANNELS } from '@shared/constants'
import { SecureStorage } from './secure-storage'
import { PatternDetector } from './pattern-detector'
import { TelegramNotifier } from './telegram-notifier'
import { DiscordNotifier } from './discord-notifier'

export class NotificationManager extends EventEmitter {
  private settings: NotificationSettings
  private storage: SecureStorage
  private detector: PatternDetector
  private window: BrowserWindow | null = null
  private cleanupInterval: NodeJS.Timeout | null = null

  constructor() {
    super()
    this.storage = new SecureStorage()
    this.detector = new PatternDetector()
    this.settings = {
      ...DEFAULT_NOTIFICATION_SETTINGS,
      telegramConfigured: this.storage.hasTelegram(),
      discordConfigured: this.storage.hasDiscord()
    }

    // Cleanup debounce entries every minute
    this.cleanupInterval = setInterval(() => this.detector.cleanup(), 60000)
  }

  setWindow(window: BrowserWindow): void {
    this.window = window
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
    return this.getSettings()
  }

  // Process terminal output for pattern detection
  processOutput(terminalId: string, output: string): void {
    const result = this.detector.detect(terminalId, output)
    if (result) {
      this.triggerNotification(result.type, terminalId, result.match)
    }
  }

  private async triggerNotification(
    type: NotificationEventType,
    terminalId: string,
    message: string
  ): Promise<void> {
    const settings = this.getSettings()

    // Check if event type is enabled
    const eventEnabled =
      (type === 'taskComplete' && settings.onTaskComplete) ||
      (type === 'taskFailed' && settings.onTaskFailed) ||
      (type === 'reviewNeeded' && settings.onReviewNeeded)

    if (!eventEnabled) return

    const event: NotificationEvent = {
      type,
      terminalId,
      message,
      timestamp: Date.now()
    }

    // Send to renderer for sound playback
    if (this.window && !this.window.isDestroyed()) {
      this.window.webContents.send(IPC_CHANNELS.NOTIFICATION_EVENT, event)
    }

    // Show native notification
    this.showNativeNotification(type, message)

    // Send to external platforms
    await this.sendExternalNotifications(type, message)
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

  private async sendExternalNotifications(
    type: NotificationEventType,
    message: string
  ): Promise<void> {
    const settings = this.getSettings()
    const emoji: Record<NotificationEventType, string> = {
      taskComplete: '✅',
      taskFailed: '❌',
      reviewNeeded: '👀'
    }

    const formattedMessage = `${emoji[type]} <b>MultiClaude</b>\n${message}`

    // Telegram
    if (settings.telegramEnabled && settings.telegramConfigured) {
      const creds = this.storage.getTelegram()
      if (creds) {
        const notifier = new TelegramNotifier(creds.botToken, creds.chatId)
        notifier.send(formattedMessage).catch(console.error)
      }
    }

    // Discord
    if (settings.discordEnabled && settings.discordConfigured) {
      const webhookUrl = this.storage.getDiscord()
      if (webhookUrl) {
        const discordMessage = `${emoji[type]} **MultiClaude**\n${message}`
        const notifier = new DiscordNotifier(webhookUrl)
        notifier.send(discordMessage).catch(console.error)
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
  }
}
