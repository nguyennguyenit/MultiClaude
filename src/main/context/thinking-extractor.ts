import type { ThinkingBlock } from '@shared/types/context-window'

const HISTORY_CAP = 30
const SIG_PREFIX_LEN = 16

interface PendingTurn {
  turnId: number
  timestamp: number
  signatures: string[]
}

/**
 * Per-session extractor for extended-thinking blocks. Claude Code v2.1+
 * persists thinking signature-only (no readable text); we capture counts,
 * redacted signature prefixes so the drawer can show the user *that*
 * thinking happened without treating opaque signature bytes as token volume.
 */
export class ThinkingExtractor {
  private readonly blocks: ThinkingBlock[] = []
  private pending: PendingTurn | null = null

  recordAssistantBlocks(turnId: number, contentBlocks: unknown[], timestamp: number): void {
    if (!Array.isArray(contentBlocks)) return
    for (const raw of contentBlocks) {
      if (!raw || typeof raw !== 'object') continue
      const b = raw as { type?: string; signature?: string; thinking?: string }
      if (b.type !== 'thinking') continue
      const sig = typeof b.signature === 'string' ? b.signature : ''
      if (!sig) continue
      if (!this.pending || this.pending.turnId !== turnId) {
        this.flushTurn()
        this.pending = { turnId, timestamp, signatures: [] }
      }
      this.pending.signatures.push(sig.slice(0, SIG_PREFIX_LEN))
    }
  }

  /** Closes the currently-open turn and pushes the aggregate (if any). */
  flushTurn(): void {
    const p = this.pending
    if (!p) return
    this.pending = null
    if (p.signatures.length === 0) return
    this.blocks.push({
      turnId: p.turnId,
      timestamp: p.timestamp,
      count: p.signatures.length,
      signatures: p.signatures
    })
    if (this.blocks.length > HISTORY_CAP) this.blocks.shift()
  }

  getBlocks(): ThinkingBlock[] {
    return this.blocks
  }
}
