import { EventEmitter } from 'events'
import { randomBytes } from 'node:crypto'

export type PairingState = 'idle' | 'waiting' | 'completed'

export interface TelegramAuthFlowOptions {
  pairingWindowMs?: number
  postSuccessWindowMs?: number
}

const DEFAULT_PAIRING_WINDOW_MS = 60_000
const DEFAULT_POST_SUCCESS_WINDOW_MS = 5_000

interface PairedPayload {
  chatId: number
  botToken: string
}

interface WaitingPayload {
  nonce: string
  botToken: string
  deepLink: (botUsername: string) => string
}

/**
 * Pairing state machine for the QR deep-link flow.
 *
 * Events:
 * - 'pairingWaiting' — emitted when startPairing transitions to waiting.
 * - 'paired' — emitted on a successful nonce match.
 * - 'pairingTimeout' — emitted when the pairing window expires with no match.
 * - 'pairingWarning' — emitted when a second /start with the matching nonce
 *   arrives within `postSuccessWindowMs` (indicates another device tried to pair).
 */
export class TelegramAuthFlow extends EventEmitter {
  private state: PairingState = 'idle'
  private nonce: string | null = null
  private botToken: string | null = null
  private pairedChatId: number | null = null
  private pairingWindowMs: number
  private postSuccessWindowMs: number
  private timeoutHandle: ReturnType<typeof setTimeout> | null = null
  private postSuccessHandle: ReturnType<typeof setTimeout> | null = null

  constructor(options: TelegramAuthFlowOptions = {}) {
    super()
    this.pairingWindowMs = options.pairingWindowMs ?? DEFAULT_PAIRING_WINDOW_MS
    this.postSuccessWindowMs = options.postSuccessWindowMs ?? DEFAULT_POST_SUCCESS_WINDOW_MS
  }

  getState(): PairingState {
    return this.state
  }

  startPairing(botToken: string): { nonce: string } {
    if (this.state === 'waiting') {
      throw new Error('Pairing already in progress')
    }

    const nonce = randomBytes(8).toString('hex')
    this.state = 'waiting'
    this.nonce = nonce
    this.botToken = botToken

    this.timeoutHandle = setTimeout(() => this.onTimeout(), this.pairingWindowMs)

    const payload: WaitingPayload = {
      nonce,
      botToken,
      deepLink: (botUsername: string) => `https://t.me/${botUsername}?start=mc-pair-${nonce}`
    }
    this.emit('pairingWaiting', payload)
    return { nonce }
  }

  /** Returns true if currently waiting AND nonce matches. */
  isMatchingNonce(candidate: string): boolean {
    return this.state === 'waiting' && this.nonce === candidate
  }

  completePairing(candidateNonce: string, chatId: number): boolean {
    if (this.state === 'completed' && this.nonce === candidateNonce) {
      // Second device after success — emit warning only if within post-success window.
      if (this.postSuccessHandle !== null && chatId !== this.pairedChatId) {
        this.emit('pairingWarning', { chatId })
      }
      return false
    }
    if (this.state !== 'waiting') return false
    if (this.nonce !== candidateNonce) return false

    this.clearTimeoutHandle()
    this.state = 'completed'
    this.pairedChatId = chatId

    this.postSuccessHandle = setTimeout(() => {
      this.postSuccessHandle = null
      this.resetToIdle()
    }, this.postSuccessWindowMs)

    this.emit('paired', { chatId, botToken: this.botToken } as PairedPayload)
    return true
  }

  cancelPairing(): void {
    if (this.state === 'idle') return
    this.clearTimeoutHandle()
    this.clearPostSuccessHandle()
    this.resetToIdle()
  }

  private onTimeout(): void {
    if (this.state !== 'waiting') return
    this.timeoutHandle = null
    this.resetToIdle()
    this.emit('pairingTimeout')
  }

  private resetToIdle(): void {
    this.state = 'idle'
    this.nonce = null
    this.botToken = null
    this.pairedChatId = null
    this.clearTimeoutHandle()
    // Note: don't clear postSuccessHandle here — it must still expire to drop warning window.
  }

  private clearTimeoutHandle(): void {
    if (this.timeoutHandle !== null) {
      clearTimeout(this.timeoutHandle)
      this.timeoutHandle = null
    }
  }

  private clearPostSuccessHandle(): void {
    if (this.postSuccessHandle !== null) {
      clearTimeout(this.postSuccessHandle)
      this.postSuccessHandle = null
    }
  }
}

/** Shared singleton used by IPC handlers and the poller. */
export const telegramAuthFlow = new TelegramAuthFlow()
