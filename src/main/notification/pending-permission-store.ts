import { randomUUID } from 'node:crypto'

export type PermissionDecision =
  | { behavior: 'allow' }
  | { behavior: 'deny'; message: string }

export interface PendingPermissionEntry {
  id: string
  sessionId: string
  terminalId?: string
  toolName: string
  toolInput: Record<string, unknown>
  createdAt: number
  resolve: (decision: PermissionDecision) => void
  chatId?: string | number
  messageId?: number
}

/**
 * In-memory store of outstanding PermissionRequest hook invocations.
 * Each entry carries a deferred `resolve` which unblocks the HTTP response
 * when the phone user taps allow/deny in Telegram.
 */
export class PendingPermissionStore {
  private readonly map: Map<string, PendingPermissionEntry> = new Map()

  create(entry: Omit<PendingPermissionEntry, 'id' | 'createdAt'>): PendingPermissionEntry {
    const id = randomUUID().replace(/-/g, '').slice(0, 12)
    const full: PendingPermissionEntry = { ...entry, id, createdAt: Date.now() }
    this.map.set(id, full)
    return full
  }

  get(id: string): PendingPermissionEntry | undefined {
    return this.map.get(id)
  }

  list(): PendingPermissionEntry[] {
    return [...this.map.values()]
  }

  resolve(id: string, decision: PermissionDecision): boolean {
    const entry = this.map.get(id)
    if (!entry) return false
    this.map.delete(id)
    entry.resolve(decision)
    return true
  }

  delete(id: string): boolean {
    return this.map.delete(id)
  }

  attachMessage(id: string, chatId: string | number, messageId: number): void {
    const entry = this.map.get(id)
    if (!entry) return
    entry.chatId = chatId
    entry.messageId = messageId
  }

  size(): number {
    return this.map.size
  }

  clear(): void {
    this.map.clear()
  }
}

export const pendingPermissionStore = new PendingPermissionStore()
