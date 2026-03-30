import type { NotificationEventType } from '@shared/types/notification'
import type { TaskEvent } from '@shared/types/notification-events'
import type { NotificationTestResult } from '@shared/types'

const TELEGRAM_MAX_LENGTH = 4096
const TELEGRAM_MAX_RETRIES = 3
const TELEGRAM_INITIAL_BACKOFF_MS = 1000
const MAX_FIELD_LENGTH = 256

interface InlineKeyboardButton {
  text: string
  callback_data: string
}

/**
 * Sends Telegram notifications via Bot API.
 * Uses HTML formatting, exponential backoff on rate limits, and message pagination.
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

  /** Send text using MarkdownV2 parse mode (for command replies with backticks, bold, etc.) */
  async sendMarkdown(text: string): Promise<boolean> {
    const chunks = this.paginateMessage(text)
    for (const chunk of chunks) {
      const ok = await this.sendWithRetry(chunk, undefined, 'MarkdownV2')
      if (!ok) return false
    }
    return true
  }

  async sendTaskEvent(event: TaskEvent, terminalTitle?: string): Promise<boolean> {
    const text = this.formatTaskEvent(event, terminalTitle)
    const keyboard = this.buildEventKeyboard(event)
    const chunks = this.paginateMessage(text)
    for (let i = 0; i < chunks.length; i++) {
      const isLast = i === chunks.length - 1
      const replyMarkup = isLast ? { inline_keyboard: keyboard } : undefined
      const ok = await this.sendWithRetry(chunks[i], replyMarkup)
      if (!ok) return false
    }
    return true
  }

  private async sendWithRetry(
    text: string,
    replyMarkup?: { inline_keyboard: InlineKeyboardButton[][] },
    parseMode: 'HTML' | 'MarkdownV2' = 'HTML'
  ): Promise<boolean> {
    let backoff = TELEGRAM_INITIAL_BACKOFF_MS

    for (let attempt = 0; attempt <= TELEGRAM_MAX_RETRIES; attempt++) {
      try {
        const body: Record<string, unknown> = {
          chat_id: this.chatId,
          text,
          parse_mode: parseMode,
          disable_web_page_preview: true
        }
        if (replyMarkup) body.reply_markup = replyMarkup

        const response = await fetch(
          `https://api.telegram.org/bot${this.botToken}/sendMessage`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
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

  private formatTaskEvent(event: TaskEvent, terminalTitle?: string): string {
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

    const projectName = this.escapeHtml(event.projectName.slice(0, MAX_FIELD_LENGTH))
    const taskName = this.escapeHtml(event.taskName.slice(0, MAX_FIELD_LENGTH))

    const headerLine = terminalTitle
      ? `📁 ${projectName}  ·  🖥 ${this.escapeHtml(terminalTitle.slice(0, MAX_FIELD_LENGTH))}`
      : `📁 <b>Project:</b> ${projectName}`

    const lines = [
      `${emoji[event.type]} <b>${titles[event.type]}</b>`,
      '',
      headerLine,
      `📝 <b>Task:</b> ${taskName}`
    ]

    if (event.context) {
      lines.push(`💬 <b>Context:</b> ${this.escapeHtml(event.context.slice(0, MAX_FIELD_LENGTH))}`)
    }

    lines.push('', `<i>🕐 ${this.escapeHtml(time)} · MultiClaude</i>`)

    return lines.join('\n')
  }

  private buildEventKeyboard(event: TaskEvent): InlineKeyboardButton[][] {
    const chatText = event.type === 'reviewNeeded' ? 'Trả lời 💬' : 'Chat 💬'
    return [[
      { text: 'Chi tiết 🔍', callback_data: `tail:${event.terminalId}` },
      { text: chatText, callback_data: `chat:${event.terminalId}` }
    ]]
  }

  /** Escape HTML special characters */
  private escapeHtml(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
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

  /** Register bot commands with Telegram so users see autocomplete suggestions */
  static async registerBotCommands(botToken: string): Promise<void> {
    const commands = [
      { command: 'status', description: 'List running terminals' },
      { command: 'send', description: 'Send input to terminal' },
      { command: 'kill', description: 'Kill a terminal' },
      { command: 'tail', description: 'View last N lines of terminal output' },
      { command: 'project', description: 'Switch or list projects' },
      { command: 'new', description: 'Open a new terminal [claude|codex]' },
      { command: 'help', description: 'Show available commands' }
    ]

    try {
      await fetch(`https://api.telegram.org/bot${botToken}/setMyCommands`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ commands })
      })
    } catch (error) {
      console.error('[TelegramNotifier] Failed to register bot commands:', error)
    }
  }

  static async test(botToken: string, chatId: string): Promise<NotificationTestResult> {
    try {
      const response = await fetch(
        `https://api.telegram.org/bot${botToken}/sendMessage`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: chatId,
            text: '🔔 MultiClaude: Test notification successful!',
            disable_web_page_preview: true
          })
        }
      )

      const data = (await response.json()) as { ok: boolean; description?: string }
      if (data.ok) return { success: true }
      return { success: false, error: data.description ?? 'Failed to send message. Check token and chat ID.' }
    } catch (error) {
      return { success: false, error: `Network error: ${String(error)}` }
    }
  }
}
