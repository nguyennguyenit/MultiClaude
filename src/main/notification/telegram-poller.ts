import type { RemoteControlStatus } from '@shared/types'
import type { TelegramAuthFlow } from './telegram-auth-flow'

const POLL_TIMEOUT = 30
const MAX_BACKOFF_MS = 30_000
const INITIAL_BACKOFF_MS = 1000
const PAIR_PREFIX = '/start mc-pair-'

type MessageHandler = (text: string) => void
type CallbackHandler = (callbackId: string, data: string) => void
type StatusHandler = (status: RemoteControlStatus) => void

/**
 * Long-polls Telegram Bot API getUpdates endpoint.
 * Filters messages by whitelisted chat ID and forwards text to handler.
 */
export class TelegramPoller {
  private botToken: string
  private chatId: string
  private offset = 0
  private needsResync = false
  private running = false
  private paused = false
  private backoff = INITIAL_BACKOFF_MS
  private abortController: AbortController | null = null
  private messageHandler: MessageHandler | null = null
  private callbackHandler: CallbackHandler | null = null
  private statusHandler: StatusHandler | null = null
  private authFlow: TelegramAuthFlow | null = null
  private currentStatus: RemoteControlStatus = 'disconnected'

  constructor(botToken: string, chatId: string) {
    this.botToken = botToken
    this.chatId = chatId
  }

  onMessage(handler: MessageHandler): void {
    this.messageHandler = handler
  }

  onCallback(handler: CallbackHandler): void {
    this.callbackHandler = handler
  }

  onStatusChange(handler: StatusHandler): void {
    this.statusHandler = handler
  }

  attachAuthFlow(flow: TelegramAuthFlow): void {
    this.authFlow = flow
  }

  getStatus(): RemoteControlStatus {
    return this.currentStatus
  }

  /** Start the polling loop. Skips stale queued messages from while app was offline. */
  async start(): Promise<void> {
    if (this.running) return
    this.running = true
    this.backoff = INITIAL_BACKOFF_MS
    this.needsResync = true

    this.pollLoop()
  }

  /** Stop polling gracefully */
  stop(): void {
    this.running = false
    this.paused = false
    this.needsResync = false
    this.abortController?.abort()
    this.abortController = null
    // Always emit disconnected on explicit stop
    this.currentStatus = 'disconnected'
    this.statusHandler?.('disconnected')
  }

  /** Pause polling (e.g., system suspend) */
  pause(): void {
    this.paused = true
    this.abortController?.abort()
  }

  /** Resume polling (e.g., system resume) */
  resume(): void {
    if (!this.running) return
    this.paused = false
    this.backoff = INITIAL_BACKOFF_MS
    this.needsResync = true
    this.pollLoop()
  }

  /** Execute a single poll cycle — exposed for testing */
  async pollOnce(): Promise<void> {
    try {
      if (this.needsResync) {
        const synced = await this.syncToLatest()
        if (!synced) return
      }

      this.abortController = new AbortController()
      const url = `https://api.telegram.org/bot${this.botToken}/getUpdates?offset=${this.offset}&timeout=${POLL_TIMEOUT}`

      const response = await fetch(url, { signal: this.abortController.signal })

      if (!response.ok) {
        if (response.status === 401 || response.status === 404) {
          console.error('[TelegramPoller] Invalid bot token, stopping')
          this.needsResync = false
          this.setStatus('error')
          this.running = false
          return
        }
        this.needsResync = true
        this.setStatus('reconnecting')
        return
      }

      const data = (await response.json()) as {
        ok: boolean
        result: Array<{
          update_id: number
          message?: { chat: { id: number }; text?: string }
          callback_query?: {
            id: string
            from: { id: number }
            data?: string
            message?: { message_id: number; chat: { id: number } }
          }
        }>
      }

      if (!data.ok || !data.result) {
        this.needsResync = true
        this.setStatus('reconnecting')
        return
      }

      for (const update of data.result) {
        this.offset = update.update_id + 1

        if (update.callback_query) {
          const cq = update.callback_query
          const cqChatId = cq.message?.chat?.id
          if (cqChatId && String(cqChatId) === String(this.chatId)) {
            if (cq.data) {
              this.callbackHandler?.(cq.id, cq.data)
            }
            // Must answer every callback query — dismisses button loading spinner
            this.answerCallbackQuery(cq.id).catch(() => {})
          }
          continue
        }

        const msgChatId = update.message?.chat?.id
        const text = update.message?.text

        // Pairing hook: during waiting state, accept /start mc-pair-<nonce>
        // from ANY chatId if the nonce matches exactly.
        if (text && msgChatId && this.authFlow?.getState() === 'waiting') {
          if (text.startsWith(PAIR_PREFIX)) {
            const candidate = text.slice(PAIR_PREFIX.length).trim()
            if (candidate.length > 0) {
              this.authFlow.completePairing(candidate, Number(msgChatId))
            }
            continue
          }
        }

        if (!msgChatId || String(msgChatId) !== String(this.chatId)) continue
        if (text && this.messageHandler) {
          this.messageHandler(text)
        }
      }

      this.backoff = INITIAL_BACKOFF_MS
      this.setStatus('connected')
    } catch (error) {
      if ((error as Error).name === 'AbortError') return
      console.error('[TelegramPoller] Poll error:', (error as Error).message)
      this.needsResync = true
      this.setStatus('reconnecting')
    }
  }

  private async answerCallbackQuery(callbackQueryId: string): Promise<void> {
    try {
      await fetch(`https://api.telegram.org/bot${this.botToken}/answerCallbackQuery`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ callback_query_id: callbackQueryId })
      })
    } catch {
      // Ignore — button spinner auto-dismisses after Telegram timeout
    }
  }

  private async syncToLatest(): Promise<boolean> {
    try {
      this.abortController = new AbortController()
      const url = `https://api.telegram.org/bot${this.botToken}/getUpdates?offset=-1&timeout=0`
      const response = await fetch(url, { signal: this.abortController.signal })

      if (!response.ok) {
        if (response.status === 401 || response.status === 404) {
          console.error('[TelegramPoller] Invalid bot token, stopping')
          this.needsResync = false
          this.setStatus('error')
          this.running = false
          return false
        }

        this.setStatus('reconnecting')
        return false
      }

      const data = (await response.json()) as { ok: boolean; result: Array<{ update_id: number }> }
      if (!data.ok || !data.result) {
        this.setStatus('reconnecting')
        return false
      }

      if (data.result.length > 0) {
        this.offset = data.result[data.result.length - 1].update_id + 1
      }

      this.needsResync = false
      return true
    } catch (error) {
      if ((error as Error).name === 'AbortError') return false
      console.error('[TelegramPoller] Resync error:', (error as Error).message)
      this.setStatus('reconnecting')
      return false
    }
  }

  private async pollLoop(): Promise<void> {
    while (this.running && !this.paused) {
      await this.pollOnce()
      if (this.currentStatus === 'reconnecting') {
        await this.sleep(this.backoff)
        this.backoff = Math.min(this.backoff * 2, MAX_BACKOFF_MS)
      }
    }
  }

  private setStatus(status: RemoteControlStatus): void {
    if (this.currentStatus === status) return
    this.currentStatus = status
    this.statusHandler?.(status)
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }
}
