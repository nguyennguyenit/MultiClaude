import type { RemoteControlStatus } from '@shared/types'

const POLL_TIMEOUT = 30
const MAX_BACKOFF_MS = 30_000
const INITIAL_BACKOFF_MS = 1000

type MessageHandler = (text: string) => void
type StatusHandler = (status: RemoteControlStatus) => void

/**
 * Long-polls Telegram Bot API getUpdates endpoint.
 * Filters messages by whitelisted chat ID and forwards text to handler.
 */
export class TelegramPoller {
  private botToken: string
  private chatId: string
  private offset = 0
  private running = false
  private paused = false
  private backoff = INITIAL_BACKOFF_MS
  private abortController: AbortController | null = null
  private messageHandler: MessageHandler | null = null
  private statusHandler: StatusHandler | null = null
  private currentStatus: RemoteControlStatus = 'disconnected'

  constructor(botToken: string, chatId: string) {
    this.botToken = botToken
    this.chatId = chatId
  }

  onMessage(handler: MessageHandler): void {
    this.messageHandler = handler
  }

  onStatusChange(handler: StatusHandler): void {
    this.statusHandler = handler
  }

  /** Start the polling loop. Skips stale queued messages from while app was offline. */
  async start(): Promise<void> {
    if (this.running) return
    this.running = true
    this.backoff = INITIAL_BACKOFF_MS

    // Skip stale updates queued while offline (spec: offset=-1 on startup)
    try {
      const url = `https://api.telegram.org/bot${this.botToken}/getUpdates?offset=-1&timeout=0`
      const res = await fetch(url)
      const data = (await res.json()) as { ok: boolean; result: Array<{ update_id: number }> }
      if (data.ok && data.result.length > 0) {
        this.offset = data.result[data.result.length - 1].update_id + 1
      }
    } catch {
      // Ignore — will process from wherever offset is
    }

    this.pollLoop()
  }

  /** Stop polling gracefully */
  stop(): void {
    this.running = false
    this.paused = false
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
    this.pollLoop()
  }

  /** Execute a single poll cycle — exposed for testing */
  async pollOnce(): Promise<void> {
    try {
      this.abortController = new AbortController()
      const url = `https://api.telegram.org/bot${this.botToken}/getUpdates?offset=${this.offset}&timeout=${POLL_TIMEOUT}`

      const response = await fetch(url, { signal: this.abortController.signal })

      if (!response.ok) {
        if (response.status === 401 || response.status === 404) {
          console.error('[TelegramPoller] Invalid bot token, stopping')
          this.setStatus('error')
          this.running = false
          return
        }
        this.setStatus('reconnecting')
        return
      }

      const data = (await response.json()) as {
        ok: boolean
        result: Array<{
          update_id: number
          message?: { chat: { id: number }; text?: string }
        }>
      }

      if (!data.ok || !data.result) {
        this.setStatus('reconnecting')
        return
      }

      for (const update of data.result) {
        this.offset = update.update_id + 1
        const msgChatId = update.message?.chat?.id
        if (!msgChatId || String(msgChatId) !== String(this.chatId)) continue
        const text = update.message?.text
        if (text && this.messageHandler) {
          this.messageHandler(text)
        }
      }

      this.backoff = INITIAL_BACKOFF_MS
      this.setStatus('connected')
    } catch (error) {
      if ((error as Error).name === 'AbortError') return
      console.error('[TelegramPoller] Poll error:', (error as Error).message)
      this.setStatus('reconnecting')
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
