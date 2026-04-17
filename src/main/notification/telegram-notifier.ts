import type { NotificationEventType } from '@shared/types/notification'
import type { TaskEvent, AskUserQuestionPayload } from '@shared/types/notification-events'
import type { NotificationTestResult, AgentType } from '@shared/types'
import { AGENT_DISPLAY_NAMES } from '@shared/constants/notification'
import { pendingQuestionStore } from './pending-question-store'

const TELEGRAM_MAX_LENGTH = 4096
const TELEGRAM_MAX_RETRIES = 3
const TELEGRAM_INITIAL_BACKOFF_MS = 1000
const MAX_FIELD_LENGTH = 256
const MAX_BUTTON_TEXT_LEN = 60
const MAX_BUTTONS_PER_ROW = 3
const MAX_OPTION_ROWS = 8

const AGENT_EMOJI: Record<AgentType, string> = {
  claude: '🟣',
  codex: '🟢',
  gemini: '🔵',
  aider: '🟠',
  generic: '⚪',
}

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
    // Persist question payload so callback handler can resolve label→text later.
    // `put()` returns a questionId used to stamp the callback_data so stale
    // taps on an earlier notification cannot be applied to a newer question.
    let questionId: string | undefined
    if (event.question && event.question.options.length > 0) {
      questionId = pendingQuestionStore.put(event.terminalId, event.question)
    }

    const text = this.formatTaskEvent(event, terminalTitle)
    const keyboard = this.buildEventKeyboard(event, questionId)
    const chunks = this.paginateMessage(text)

    for (let i = 0; i < chunks.length; i++) {
      const isLast = i === chunks.length - 1
      const replyMarkup = isLast ? { inline_keyboard: keyboard } : undefined
      const result = await this.sendMessageRaw(chunks[i], replyMarkup)
      if (!result.ok) return false

      // Remember the keyboard message so toggles can edit it in place.
      if (isLast && questionId && result.messageId !== undefined) {
        pendingQuestionStore.attachMessage(event.terminalId, this.chatId, result.messageId)
      }
    }
    return true
  }

  private async sendWithRetry(
    text: string,
    replyMarkup?: { inline_keyboard: InlineKeyboardButton[][] },
    parseMode: 'HTML' | 'MarkdownV2' = 'HTML'
  ): Promise<boolean> {
    return (await this.sendMessageRaw(text, replyMarkup, parseMode)).ok
  }

  private async sendMessageRaw(
    text: string,
    replyMarkup?: { inline_keyboard: InlineKeyboardButton[][] },
    parseMode: 'HTML' | 'MarkdownV2' = 'HTML'
  ): Promise<{ ok: boolean; messageId?: number }> {
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

        const data = (await response.json()) as {
          ok: boolean
          result?: { message_id?: number }
        }
        if (data.ok === true) {
          return { ok: true, messageId: data.result?.message_id }
        }
        return { ok: false }
      } catch (error) {
        if (attempt === TELEGRAM_MAX_RETRIES) {
          console.error('[TelegramNotifier] Send failed after retries:', error)
          return { ok: false }
        }
        await this.sleep(backoff)
        backoff = Math.min(backoff * 2, 30_000)
      }
    }

    return { ok: false }
  }

  /**
   * Edit the reply_markup of a previously-sent message.
   * Used by toggle callbacks to refresh ⚪/🔘 state on the inline keyboard.
   */
  async editReplyMarkup(
    chatId: string | number,
    messageId: number,
    replyMarkup: { inline_keyboard: InlineKeyboardButton[][] }
  ): Promise<boolean> {
    try {
      const response = await fetch(
        `https://api.telegram.org/bot${this.botToken}/editMessageReplyMarkup`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: chatId,
            message_id: messageId,
            reply_markup: replyMarkup
          })
        }
      )
      const data = (await response.json().catch(() => ({}))) as { ok?: boolean }
      return data.ok === true
    } catch (error) {
      console.error('[TelegramNotifier] editReplyMarkup failed:', error)
      return false
    }
  }

  /** Build the same keyboard the original `sendTaskEvent` would build — used by toggle edits. */
  buildQuestionKeyboardPublic(
    terminalId: string,
    questionId: string | undefined,
    question: AskUserQuestionPayload,
    eventType: NotificationEventType,
    selected?: Set<number>
  ): InlineKeyboardButton[][] {
    return this.buildQuestionKeyboard(terminalId, question, eventType, questionId, selected)
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

    const agentType: AgentType = event.agentType ?? 'generic'
    const agentLabel = `${AGENT_EMOJI[agentType]} ${AGENT_DISPLAY_NAMES[agentType]}`

    const lines = [
      `${emoji[event.type]} <b>${titles[event.type]}</b>  ·  ${agentLabel}`,
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

  private buildEventKeyboard(event: TaskEvent, questionId?: string): InlineKeyboardButton[][] {
    if (event.question && event.question.options.length > 0) {
      return this.buildQuestionKeyboard(event.terminalId, event.question, event.type, questionId)
    }
    const chatText = event.type === 'reviewNeeded' ? 'Reply 💬' : 'Chat 💬'
    return [[
      { text: 'Details 🔍', callback_data: `tail:${event.type}:${event.terminalId}` },
      { text: chatText, callback_data: `chat:${event.terminalId}` }
    ]]
  }

  private buildQuestionKeyboard(
    terminalId: string,
    question: AskUserQuestionPayload,
    eventType: NotificationEventType,
    questionId?: string,
    selected?: Set<number>
  ): InlineKeyboardButton[][] {
    const capped = question.options.slice(0, MAX_BUTTONS_PER_ROW * MAX_OPTION_ROWS)
    const action = question.multiSelect ? 'toggle' : 'answer'
    // If no qid provided, keep legacy shape (tests assume it exists).
    const qidSuffix = questionId ? `:${questionId}` : ''

    const buttons: InlineKeyboardButton[] = capped.map((opt, i) => {
      const isSelected = question.multiSelect && selected?.has(i)
      const prefix = question.multiSelect ? (isSelected ? '🔘 ' : '⚪ ') : ''
      const safeLabel = this.sanitizeButtonText(opt.label)
      const display = this.clipLabel(prefix + safeLabel)
      return {
        text: display,
        callback_data: `${action}:${i}${qidSuffix}:${terminalId}`
      }
    })

    const rows: InlineKeyboardButton[][] = []
    for (let i = 0; i < buttons.length; i += MAX_BUTTONS_PER_ROW) {
      rows.push(buttons.slice(i, i + MAX_BUTTONS_PER_ROW))
    }

    if (question.multiSelect) {
      rows.push([{ text: 'Submit ✅', callback_data: `submit${qidSuffix}:${terminalId}` }])
    }

    rows.push([
      { text: 'Details 🔍', callback_data: `tail:${eventType}:${terminalId}` }
    ])

    return rows
  }

  private sanitizeButtonText(label: string): string {
    // Drop NUL and other C0 control chars except \t
    return label.replace(/[\x00-\x08\x0B-\x1F\x7F]/g, '')
  }

  private clipLabel(text: string): string {
    if (text.length <= MAX_BUTTON_TEXT_LEN) return text
    return text.slice(0, MAX_BUTTON_TEXT_LEN - 1) + '…'
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
