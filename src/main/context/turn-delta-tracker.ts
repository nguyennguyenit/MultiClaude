import {
  CONTEXT_CATEGORIES,
  type CategoryDelta,
  type CategoryDeltaItem,
  type ContextCategory,
  type TurnDeltaDetail,
  type TurnDeltaSummary
} from '@shared/types/context-window'

const HISTORY_CAP = 50

interface RecordItemInput {
  label: string
  tokens: number
  content: string
  path?: string
}

interface OpenTurn {
  turnId: number
  byCategory: Record<ContextCategory, CategoryDelta>
  totalDelta: number
}

function emptyByCategory(): Record<ContextCategory, CategoryDelta> {
  const out = {} as Record<ContextCategory, CategoryDelta>
  for (const c of CONTEXT_CATEGORIES) out[c] = { tokens: 0, items: [] }
  return out
}

/**
 * FNV-1a 64-bit hash → 16-char hex digest. No deps; sufficient for content
 * dedup (collision rate well below practical impact for this use case).
 */
export function hashContent(content: string): string {
  // Use BigInt to keep 64-bit semantics
  let hash = 0xcbf29ce484222325n
  const prime = 0x100000001b3n
  const mask = 0xffffffffffffffffn
  for (let i = 0; i < content.length; i++) {
    hash ^= BigInt(content.charCodeAt(i))
    hash = (hash * prime) & mask
  }
  return hash.toString(16).padStart(16, '0')
}

/**
 * Tracks per-turn token deltas with content-hash dedup so re-injected blocks
 * (e.g. CLAUDE.md across turns) don't inflate later turns. Keeps a FIFO of
 * the last {@link HISTORY_CAP} summaries; details are lookup-only via
 * {@link getDetail}.
 */
export class TurnDeltaTracker {
  private readonly seenHashes = new Set<string>()
  private readonly summaries: TurnDeltaSummary[] = []
  private readonly details = new Map<number, TurnDeltaDetail>()
  private open: OpenTurn | null = null

  recordItem(turnId: number, category: ContextCategory, input: RecordItemInput): void {
    const turn = this.ensureOpen(turnId)
    const hash = hashContent(input.content)
    if (this.seenHashes.has(hash)) return
    this.seenHashes.add(hash)
    const item: CategoryDeltaItem = {
      label: input.label,
      tokens: input.tokens,
      contentHash: hash,
      ...(input.path ? { path: input.path } : {})
    }
    turn.byCategory[category].items.push(item)
    turn.byCategory[category].tokens += input.tokens
    turn.totalDelta += input.tokens
  }

  closeTurn(turnId: number, timestamp: number): void {
    const turn = this.ensureOpen(turnId)
    const perCategoryTokens = {} as Record<ContextCategory, number>
    for (const c of CONTEXT_CATEGORIES) perCategoryTokens[c] = turn.byCategory[c].tokens
    this.summaries.push({
      turnId: turn.turnId,
      timestamp,
      totalDelta: turn.totalDelta,
      perCategoryTokens
    })
    this.details.set(turn.turnId, { turnId: turn.turnId, byCategory: turn.byCategory })
    if (this.summaries.length > HISTORY_CAP) {
      const evicted = this.summaries.shift()
      if (evicted) this.details.delete(evicted.turnId)
    }
    this.open = null
  }

  getSummaries(): TurnDeltaSummary[] {
    return this.summaries
  }

  getDetail(turnId: number): TurnDeltaDetail | null {
    return this.details.get(turnId) ?? null
  }

  private ensureOpen(turnId: number): OpenTurn {
    if (this.open && this.open.turnId === turnId) return this.open
    if (this.open) this.closeTurn(this.open.turnId, Date.now())
    this.open = { turnId, byCategory: emptyByCategory(), totalDelta: 0 }
    return this.open
  }
}
