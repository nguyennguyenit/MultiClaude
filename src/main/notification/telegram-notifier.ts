import type { NotificationTestResult, NotificationEventType } from '@shared/types'
import type { TaskEvent } from '@shared/types/notification-events'

const TELEGRAM_MAX_LENGTH = 4096
const TELEGRAM_MAX_RETRIES = 3
const TELEGRAM_INITIAL_BACKOFF_MS = 1000

/**
 * Sends Telegram notifications via Bot API.
 * Uses MarkdownV2 formatting, exponential backoff on rate limits, and message pagination.
 * Inspired by ccpoke's Telegram integration patterns.
 */
export class TelegramNotifier {
  private botToken: string
  private chatId: string

  constructor(botToken: string, chatId: string) {
    this.botToken = botToken
    this.chatId = chatId
  }

  async send(text: string): Promise<boolean> {
    const chunks = this.paginateMessage(text)
    for (const chunk of chunks) {
      const ok = await this.sendWithRetry(chunk)
      if (!ok) return false
    }
    return true
  }

  async sendTaskEvent(event: TaskEvent): Promise<boolean> {
    return this.send(this.formatTaskEvent(event))
  }

  private async sendWithRetry(text: string): Promise<boolean> {
    let backoff = TELEGRAM_INITIAL_BACKOFF_MS

    for (let attempt = 0; attempt <= TELEGRAM_MAX_RETRIES; attempt++) {
      try {
        const response = await fetch(
          `https://api.telegram.org/bot${this.botToken}/sendMessage`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              chat_id: this.chatId,
              text,
              parse_mode: 'MarkdownV2',
              disable_web_page_preview: true
            })
          }
        )

        // Exponential backoff on rate limit (inspired by ccpoke)
        if (response.status === 429) {
          const data = (await response.json().catch(() => ({}))) as {
            parameters?: { retry_after?: number }
          }
          const retryAfterMs = (data.parameters?.retry_after ?? backoff / 1000) * 1000
          await this.sleep(retryAfterMs)
          backoff = Math.min(backoff * 2, 30_000)
          continue
        }

        const data = (await response.json()) as { ok: boolean }
        return data.ok === true
      } catch (error) {
        if (attempt === TELEGRAM_MAX_RETRIES) {
          console.error('[TelegramNotifier] Send failed after retries:', error)
          return false
        }
        await this.sleep(backoff)
        backoff = Math.min(backoff * 2, 30_000)
      }
    }

    return false
  }

  private static readonly MAX_FIELD_LENGTH = 200

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

    const time = new Date(event.timestamp).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    })

    const lines = [
      `${emoji[event.type]} *${this.esc(titles[event.type])}*`,
      '',
      `📁 *Project:* \`${this.esc(event.projectName.slice(0, TelegramNotifier.MAX_FIELD_LENGTH))}\``,
      `📝 *Task:* ${this.esc(event.taskName.slice(0, TelegramNotifier.MAX_FIELD_LENGTH))}`
    ]

    if (event.context) {
      lines.push(
        `💬 *Context:* ${this.esc(event.context.slice(0, TelegramNotifier.MAX_FIELD_LENGTH))}`
      )
    }

    lines.push('', `_🕐 ${this.esc(time)} · MultiClaude_`)

    return lines.join('\n')
  }

  /** Escape MarkdownV2 special characters per Telegram spec */
  private esc(text: string): string {
    return text.replace(/[_*[\]()~`>#+\-=|{}.!\\]/g, '\\$&')
  }

  /** Split message into ≤4096-char chunks at line boundaries */
  private paginateMessage(text: string): string[] {
    if (text.length <= TELEGRAM_MAX_LENGTH) return [text]

    const chunks: string[] = []
    const lines = text.split('\n')
    let current = ''

    for (const line of lines) {
      const next = current ? `${current}\n${line}` : line
      if (next.length > TELEGRAM_MAX_LENGTH) {
        if (current) chunks.push(current)
        current = line
      } else {
        current = next
      }
    }

    if (current) chunks.push(current)
    return chunks
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }

  static async test(botToken: string, chatId: string): Promise<NotificationTestResult> {
    try {
      const notifier = new TelegramNotifier(botToken, chatId)
      const success = await notifier.send('🔔 *MultiClaude*: Test notification successful\\!')
      return success
        ? { success: true }
        : { success: false, error: 'Failed to send message. Check token and chat ID.' }
    } catch (error) {
      return { success: false, error: String(error) }
    }
  }
}
