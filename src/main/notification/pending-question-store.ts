import { randomBytes } from 'node:crypto'
import type { AskUserQuestionPayload } from '@shared/types'

export interface PendingQuestionEntry {
  question: AskUserQuestionPayload
  expiresAt: number
  /** Zero-based option indices selected (for multiSelect questions) */
  selected: Set<number>
  /** Unique short id for this question — embedded in callback_data to defeat overwrite races */
  questionId: string
  /** Telegram message_id of the notification carrying this question (for editMessageReplyMarkup) */
  messageId?: number
  /** Telegram chat_id where the notification was delivered */
  chatId?: string | number
}

export interface PendingQuestionStoreOptions {
  /** Time-to-live for each entry (default 10 minutes) */
  ttlMs?: number
  /** Maximum entries before LRU eviction (default 50) */
  maxEntries?: number
}

const DEFAULT_TTL_MS = 10 * 60 * 1000
const DEFAULT_MAX = 50

/**
 * In-memory store of pending `AskUserQuestion` payloads, keyed by terminalId.
 * - Lazy TTL cleanup in `get`/`put`.
 * - Insertion-order LRU (Map iteration order) with bump-on-access in `get`.
 * - Non-multiSelect questions ignore toggle calls.
 */
export class PendingQuestionStore {
  private readonly map: Map<string, PendingQuestionEntry> = new Map()
  private readonly ttlMs: number
  private readonly maxEntries: number

  constructor(options: PendingQuestionStoreOptions = {}) {
    this.ttlMs = options.ttlMs ?? DEFAULT_TTL_MS
    this.maxEntries = options.maxEntries ?? DEFAULT_MAX
  }

  put(terminalId: string, question: AskUserQuestionPayload): string {
    this.sweepExpired()
    // Delete first so re-insert moves key to end of iteration order (fresh slot).
    this.map.delete(terminalId)
    const questionId = randomBytes(3).toString('hex') // 6 hex chars → ~24 bits entropy
    this.map.set(terminalId, {
      question,
      expiresAt: Date.now() + this.ttlMs,
      selected: new Set<number>(),
      questionId
    })
    this.evictUntilUnderCap()
    return questionId
  }

  /**
   * Attach the Telegram message_id + chat_id of the notification that carries this question.
   * Enables `editMessageReplyMarkup` to refresh the keyboard on toggle.
   */
  attachMessage(terminalId: string, chatId: string | number, messageId: number): void {
    const entry = this.map.get(terminalId)
    if (!entry) return
    entry.chatId = chatId
    entry.messageId = messageId
  }

  get(terminalId: string): PendingQuestionEntry | undefined {
    const entry = this.map.get(terminalId)
    if (!entry) return undefined
    if (entry.expiresAt <= Date.now()) {
      this.map.delete(terminalId)
      return undefined
    }
    // Bump recency: re-insert so it moves to end of iteration order.
    this.map.delete(terminalId)
    this.map.set(terminalId, entry)
    return entry
  }

  /**
   * Retrieve the entry only if its stored questionId matches.
   * Defeats the race where a second AskUserQuestion overwrites the first,
   * but the user taps a button on the first (stale) notification.
   */
  getByQuestionId(terminalId: string, questionId: string): PendingQuestionEntry | undefined {
    const entry = this.get(terminalId)
    if (!entry) return undefined
    if (entry.questionId !== questionId) return undefined
    return entry
  }

  delete(terminalId: string): boolean {
    return this.map.delete(terminalId)
  }

  clear(): void {
    this.map.clear()
  }

  size(): number {
    return this.map.size
  }

  /**
   * Toggle an option's selection flag for multiSelect questions.
   * No-op for single-select questions or unknown terminalId.
   */
  toggleSelection(terminalId: string, optionIndex: number): void {
    const entry = this.get(terminalId)
    if (!entry) return
    if (!entry.question.multiSelect) return
    if (optionIndex < 0 || optionIndex >= entry.question.options.length) return
    if (entry.selected.has(optionIndex)) {
      entry.selected.delete(optionIndex)
    } else {
      entry.selected.add(optionIndex)
    }
  }

  private sweepExpired(): void {
    const now = Date.now()
    for (const [id, entry] of this.map) {
      if (entry.expiresAt <= now) this.map.delete(id)
    }
  }

  private evictUntilUnderCap(): void {
    while (this.map.size > this.maxEntries) {
      const oldestKey = this.map.keys().next().value
      if (oldestKey === undefined) break
      this.map.delete(oldestKey)
    }
  }
}

/** Shared singleton used across the notification pipeline. */
export const pendingQuestionStore = new PendingQuestionStore()
