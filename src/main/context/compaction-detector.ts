import type { CompactionEvent } from '@shared/types/context-window'

const HISTORY_CAP = 10
const SUDDEN_DROP_RATIO = 0.3
const DEDUP_WINDOW_MS = 2_000
const CLEAR_GRACE_MS = 5_000
const SUMMARY_PREVIEW_LEN = 200

interface JsonlLineShape {
  type?: string
  subtype?: string
  summary?: string
  content?: unknown
  message?: { content?: unknown }
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

function stringify(content: unknown): string {
  if (content == null) return ''
  if (typeof content === 'string') return content
  try {
    return JSON.stringify(content)
  } catch {
    return ''
  }
}

/**
 * Detects context-window auto-compaction events. Two signal types:
 * - **High confidence**: explicit JSONL `type=summary` line, or user-message
 *   content containing `<compact>` / `<conversation_summary>` markers.
 * - **Low confidence**: a >30% drop in total tokens between consecutive
 *   samples, NOT preceded by a recent `/clear` command.
 *
 * Dedupes signals within a 2s window. Caps history at 10 events.
 */
export class CompactionDetector {
  private events: CompactionEvent[] = []
  private prevTotal: number | null = null
  private lastClearAt: number | null = null
  private lastEventAt = -Infinity
  private idSeq = 0

  /** Returns the new event, or null if signal was ignored / deduped. */
  recordLine(line: object | null): CompactionEvent | null {
    if (!line || typeof line !== 'object') return null
    const l = line as JsonlLineShape

    // /clear command — note recent occurrence to suppress sudden-drop heuristic
    if (l.type === 'command_input' && typeof l.content === 'string' && l.content.trim() === '/clear') {
      this.lastClearAt = parseTs(l.timestamp)
      return null
    }

    // Explicit high-confidence signals
    const isExplicit =
      l.type === 'summary' ||
      l.subtype === 'compact_boundary' ||
      hasCompactMarker(l)
    if (!isExplicit) return null

    const ts = parseTs(l.timestamp)
    if (ts - this.lastEventAt < DEDUP_WINDOW_MS) return null

    const summary = String(l.summary ?? '').slice(0, SUMMARY_PREVIEW_LEN) || undefined
    const ev: CompactionEvent = {
      id: `c${++this.idSeq}`,
      timestamp: ts,
      beforeTokens: this.prevTotal ?? 0,
      afterTokens: this.prevTotal ?? 0,
      summary,
      confidence: 'high'
    }
    this.push(ev)
    return ev
  }

  /**
   * Tick the running total; returns a low-confidence event when a sudden
   * drop is observed and `/clear` did not fire recently.
   */
  recordTotalTokens(total: number, atMs: number): CompactionEvent | null {
    const before = this.prevTotal
    this.prevTotal = total
    if (before == null || before === 0) return null
    if (total >= before) return null
    const drop = (before - total) / before
    if (drop < SUDDEN_DROP_RATIO) return null
    if (this.lastClearAt != null && atMs - this.lastClearAt < CLEAR_GRACE_MS) return null
    if (atMs - this.lastEventAt < DEDUP_WINDOW_MS) return null
    const ev: CompactionEvent = {
      id: `c${++this.idSeq}`,
      timestamp: atMs,
      beforeTokens: before,
      afterTokens: total,
      confidence: 'low'
    }
    this.push(ev)
    return ev
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

function hasCompactMarker(line: JsonlLineShape): boolean {
  if (line.type !== 'user') return false
  const c = line.message?.content
  const text = typeof c === 'string' ? c : stringify(c)
  return text.includes('<compact>') || text.includes('<conversation_summary>')
}
