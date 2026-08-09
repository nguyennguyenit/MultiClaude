import type { CompactionEvent } from '@shared/types/context-window'

const HISTORY_CAP = 10
const DEDUP_WINDOW_MS = 2_000
const SUMMARY_PREVIEW_LEN = 200

interface JsonlLineShape {
  type?: string
  subtype?: string
  summary?: string
  content?: unknown
  timestamp?: string | number
}

function parseTs(input: string | number | undefined): number {
  if (typeof input === 'number') return input
  if (typeof input === 'string') {
    const n = Date.parse(input)
    if (!Number.isNaN(n)) return n
  }
  return Date.now()
}

/**
 * Detects context-window auto-compaction events only from explicit JSONL
 * summary or boundary signals. Token movement and user-authored text alone are not
 * evidence that compaction occurred.
 *
 * Dedupes signals within a 2s window. Caps history at 10 events.
 */
export class CompactionDetector {
  private events: CompactionEvent[] = []
  private prevTotal: number | null = null
  private lastEventAt = -Infinity
  private idSeq = 0

  /** Returns the new event, or null if signal was ignored / deduped. */
  recordLine(line: object | null): CompactionEvent | null {
    if (!line || typeof line !== 'object') return null
    const l = line as JsonlLineShape

    const source = explicitSource(l)
    if (!source) return null

    const ts = parseTs(l.timestamp)
    if (ts - this.lastEventAt < DEDUP_WINDOW_MS) return null

    const summary = String(l.summary ?? '').slice(0, SUMMARY_PREVIEW_LEN) || undefined
    const ev: CompactionEvent = {
      id: `c${++this.idSeq}`,
      timestamp: ts,
      observedTokens: this.prevTotal ?? undefined,
      summary,
      confidence: 'high',
      source
    }
    this.push(ev)
    return ev
  }

  /**
   * Remember the latest observed total for explicit-event context. A total
   * change never emits a compaction event by itself.
   */
  recordTotalTokens(total: number, _atMs: number): CompactionEvent | null {
    this.prevTotal = total
    return null
  }

  getEvents(): CompactionEvent[] {
    return this.events
  }

  private push(ev: CompactionEvent): void {
    this.events.push(ev)
    this.lastEventAt = ev.timestamp
    if (this.events.length > HISTORY_CAP) this.events.shift()
  }
}

function explicitSource(line: JsonlLineShape): CompactionEvent['source'] | null {
  if (line.type === 'summary') return 'summary'
  if (line.subtype === 'compact_boundary') return 'compact-boundary'
  return null
}
