import { EventEmitter } from 'events'
import type { ContextSnapshot, CategoryBucket } from '@shared/types/context-window'
import { emptyBuckets } from '@shared/types/context-window'
import { estimateTokens } from '@shared/utils/estimate-tokens'
import { categorizeLine, createToolUseRegistry, type ToolUseRegistry } from './context-line-categorizer'
import { ContextMentionDetector } from './context-mention-detector'
import { ClaudeMdReader } from './claude-md-reader'

const DEBOUNCE_MS = 300
const TTL_MS = 60 * 60 * 1000 // 1h idle → drop
const SWEEP_INTERVAL_MS = 5 * 60 * 1000

export interface JsonlLineEvent {
  sessionId: string
  cwd?: string
  line: unknown
  filePath: string
}

interface SessionState {
  snapshot: ContextSnapshot
  detector: ContextMentionDetector
  registry: ToolUseRegistry
  debounceTimer: NodeJS.Timeout | null
  lastActivity: number
  mdLoaded: boolean
}

/** Minimal EventEmitter-shaped source the analyzer subscribes to. */
export interface JsonlLineSource {
  on(event: 'jsonlLine', listener: (ev: JsonlLineEvent) => void): unknown
  off?(event: 'jsonlLine', listener: (ev: JsonlLineEvent) => void): unknown
}

export class ContextWindowAnalyzer extends EventEmitter {
  private sessions: Map<string, SessionState> = new Map()
  private sweepTimer: NodeJS.Timeout | null = null
  private readonly mdReader: ClaudeMdReader
  private readonly source: JsonlLineSource
  private readonly onLineBound: (ev: JsonlLineEvent) => void

  constructor(source: JsonlLineSource, mdReader: ClaudeMdReader = new ClaudeMdReader()) {
    super()
    this.source = source
    this.mdReader = mdReader
    this.onLineBound = (ev: JsonlLineEvent) => this.handleLine(ev)
    source.on('jsonlLine', this.onLineBound)
    this.sweepTimer = setInterval(() => this.sweepStale(), SWEEP_INTERVAL_MS)
    // Don't block process exit on sweep timer
    this.sweepTimer.unref?.()
  }

  getSnapshot(sessionId: string): ContextSnapshot | null {
    return this.sessions.get(sessionId)?.snapshot ?? null
  }

  destroy(): void {
    this.source.off?.('jsonlLine', this.onLineBound)
    if (this.sweepTimer) clearInterval(this.sweepTimer)
    for (const s of this.sessions.values()) {
      if (s.debounceTimer) clearTimeout(s.debounceTimer)
    }
    this.sessions.clear()
    this.removeAllListeners()
  }

  private handleLine(ev: JsonlLineEvent): void {
    const { sessionId, cwd, line } = ev
    if (!sessionId) return
    let state = this.sessions.get(sessionId)
    if (!state) {
      state = this.createSession(sessionId, cwd)
      this.sessions.set(sessionId, state)
      // Kick off async CLAUDE.md load on first line
      void this.loadClaudeMd(sessionId, cwd)
    }
    state.lastActivity = Date.now()
    const shapedLine = line as Parameters<typeof categorizeLine>[0]
    const hits = categorizeLine(shapedLine, state.detector, state.registry)
    if (hits.length === 0) return
    for (const h of hits) {
      const bucket = state.snapshot.buckets[h.category]
      bucket.tokens += h.tokens
      bucket.chars += h.chars
      bucket.itemCount += 1
      state.snapshot.total += h.tokens
    }
    state.snapshot.updatedAt = Date.now()
    this.scheduleEmit(state)
  }

  private createSession(sessionId: string, cwd?: string): SessionState {
    return {
      snapshot: {
        sessionId,
        cwd,
        buckets: emptyBuckets(),
        total: 0,
        updatedAt: Date.now()
      },
      detector: new ContextMentionDetector(),
      registry: createToolUseRegistry(),
      debounceTimer: null,
      lastActivity: Date.now(),
      mdLoaded: false
    }
  }

  private async loadClaudeMd(sessionId: string, cwd?: string): Promise<void> {
    const state = this.sessions.get(sessionId)
    if (!state || state.mdLoaded) return
    state.mdLoaded = true
    try {
      const md = await this.mdReader.load(cwd)
      if (!md.text) return
      const tokens = estimateTokens(md.text)
      const current = this.sessions.get(sessionId)
      if (!current) return
      const bucket: CategoryBucket = current.snapshot.buckets['claude-md']
      bucket.tokens += tokens
      bucket.chars += md.text.length
      bucket.itemCount += md.sources.length
      current.snapshot.total += tokens
      current.snapshot.updatedAt = Date.now()
      this.scheduleEmit(current)
    } catch {
      // ignore — md load best-effort
    }
  }

  private scheduleEmit(state: SessionState): void {
    if (state.debounceTimer) clearTimeout(state.debounceTimer)
    state.debounceTimer = setTimeout(() => {
      state.debounceTimer = null
      this.emit('snapshot', state.snapshot)
    }, DEBOUNCE_MS)
    state.debounceTimer.unref?.()
  }

  private sweepStale(): void {
    const cutoff = Date.now() - TTL_MS
    for (const [id, s] of this.sessions) {
      if (s.lastActivity < cutoff) {
        if (s.debounceTimer) clearTimeout(s.debounceTimer)
        this.sessions.delete(id)
      }
    }
  }
}
