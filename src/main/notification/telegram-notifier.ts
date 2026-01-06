import type { NotificationTestResult, NotificationEventType } from '@shared/types'
import type { TaskEvent } from '@shared/types/notification-events'

export class TelegramNotifier {
  private botToken: string
  private chatId: string

  constructor(botToken: string, chatId: string) {
    this.botToken = botToken
    this.chatId = chatId
  }

  async send(message: string): Promise<boolean> {
    try {
      const url = `https://api.telegram.org/bot${this.botToken}/sendMessage`
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: this.chatId,
          text: message,
          parse_mode: 'HTML'
        })
      })

      const data = await response.json()
      return data.ok === true
    } catch (error) {
      console.error('[TelegramNotifier] Send failed:', error)
      return false
    }
  }

  async sendTaskEvent(event: TaskEvent): Promise<boolean> {
    const message = this.formatTaskEvent(event)
    return this.send(message)
  }

  private static readonly MAX_FIELD_LENGTH = 256

  private formatTaskEvent(event: TaskEvent): string {
    const emoji: Record<NotificationEventType, string> = {
      taskComplete: '✅',
      taskFailed: '❌',
      reviewNeeded: '👀'
    }
    const titles: Record<NotificationEventType, string> = {
      taskComplete: 'Task Complete',
      taskFailed: 'Task Failed',
      reviewNeeded: 'Review Needed'
    }

    const lines = [
      `${emoji[event.type]} <b>${titles[event.type]}</b>`,
      `<b>Project:</b> ${this.escapeHtml(event.projectName.slice(0, TelegramNotifier.MAX_FIELD_LENGTH))}`,
      `<b>Task:</b> ${this.escapeHtml(event.taskName.slice(0, TelegramNotifier.MAX_FIELD_LENGTH))}`
    ]

    if (event.context) {
      lines.push(`<b>Context:</b> ${this.escapeHtml(event.context.slice(0, TelegramNotifier.MAX_FIELD_LENGTH))}`)
    }

    return lines.join('\n')
  }

  private escapeHtml(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
  }

  static async test(botToken: string, chatId: string): Promise<NotificationTestResult> {
    try {
      const notifier = new TelegramNotifier(botToken, chatId)
      const success = await notifier.send('🔔 <b>MultiClaude</b>: Test notification successful!')
      return success
        ? { success: true }
        : { success: false, error: 'Failed to send message. Check token and chat ID.' }
    } catch (error) {
      return { success: false, error: String(error) }
    }
  }
}
