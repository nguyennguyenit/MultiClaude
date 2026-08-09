/**
 * Detects `@path` mentions in user text and correlates them with subsequent
 * Read tool_use → tool_result pairs. Per-session state.
 *
 * Heuristic:
 *   1. On user text, extract `@<path>` tokens into a pending map keyed by path.
 *   2. On Read tool_use, record tool_use_id → 'mentioned' if input.file_path
 *      matches any pending entry; then consume the entry.
 *   3. On tool_result arrival, resolveToolResult(id) reports whether that
 *      specific Read was mention-originated.
 *
 * [RED-TEAM M3] TTL-based eviction (10 min) keyed on first-seen time — swept
 * on every recordUserText() call. No size cap; typical session has <100 @paths.
 */

const MENTION_TTL_MS = 10 * 60 * 1000

/** Extract @<path> tokens. Paths can contain /, ., -, _, letters, digits. */
const MENTION_RE = /(?:^|\s)@([^\s`'"<>]+)/g

interface PendingMention {
  path: string
  seenAt: number
}

export class ContextMentionDetector {
  private pending: Map<string, PendingMention> = new Map()
  /** tool_use_id → true if that Read was triggered by a mention. */
  private results: Map<string, boolean> = new Map()

  recordUserText(text: string, now: number = Date.now()): void {
    this.evictExpired(now)
    if (!text) return
    MENTION_RE.lastIndex = 0
    let match: RegExpExecArray | null
    while ((match = MENTION_RE.exec(text)) !== null) {
      const raw = match[1]
      // Normalize: strip trailing punctuation
      const clean = raw.replace(/[),.;:!?]+$/, '')
      if (!clean) continue
      if (!this.pending.has(clean)) {
        this.pending.set(clean, { path: clean, seenAt: now })
      }
    }
  }

  recordToolUse(id: string, name: string, input: unknown): void {
    if (name !== 'Read' || !input || typeof input !== 'object') return
    const file = (input as { file_path?: unknown }).file_path
    if (typeof file !== 'string') return
    const matched = this.matchPending(file)
    if (matched) {
      this.results.set(id, true)
      this.pending.delete(matched)
    }
  }

  resolveToolResult(id: string): 'mentioned' | 'normal' {
    return this.results.get(id) ? 'mentioned' : 'normal'
  }

  /** Test helper — pending size after TTL sweep. */
  _pendingSize(now: number = Date.now()): number {
    this.evictExpired(now)
    return this.pending.size
  }

  private matchPending(filePath: string): string | null {
    for (const [key] of this.pending) {
      if (filePath === key || filePath.endsWith(key)) return key
    }
    return null
  }

  private evictExpired(now: number): void {
    for (const [key, entry] of this.pending) {
      if (now - entry.seenAt > MENTION_TTL_MS) this.pending.delete(key)
    }
  }
}
