import { EventEmitter } from 'events'
import type {
  ContextSnapshot,
  CategoryBucket,
  TurnDeltaDetail
} from '@shared/types/context-window'
import { emptyBuckets } from '@shared/types/context-window'
import { estimateTokens } from '@shared/utils/estimate-tokens'
import { categorizeLine, createToolUseRegistry, type ToolUseRegistry } from './context-line-categorizer'
import { ContextMentionDetector } from './context-mention-detector'
import { ClaudeMdReader } from './claude-md-reader'
import { TurnDeltaTracker } from './turn-delta-tracker'
import { ExecutionTraceBuilder } from './execution-trace-builder'

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
  /** True after emitting an error for this session (prevents log spam). */
  errorReported: boolean
  tracker: TurnDeltaTracker
  /** Monotonic counter; bumped each time a fresh user-text turn starts. */
  currentTurnId: number
  /** Trace builder for the currently open turn. Null between turns. */
  traceBuilder: ExecutionTraceBuilder | null
}

/**
 * Detects a "fresh user turn" — a `user` line carrying authored user text,
 * not a tool_result-only payload. tool_result entries are continuations of
 * the assistant's previous turn and must NOT bump the turn counter.
 */
function isUserTextLine(line: unknown): boolean {
  if (!line || typeof line !== 'object') return false
  const l = line as { type?: string; message?: { content?: unknown } }
  if (l.type !== 'user') return false
  const c = l.message?.content
  if (typeof c === 'string') {
    return c.length > 0 && !c.includes('<system-reminder>')
  }
  if (Array.isArray(c)) {
    for (const block of c as Array<Record<string, unknown>>) {
      if (block.type === 'text') {
        const text = String(block.text ?? '')
        if (text.length > 0 && !text.includes('<system-reminder>')) return true
      }
    }
  }
  return false
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

  getTurnDetail(sessionId: string, turnId: number): TurnDeltaDetail | null {
    return this.sessions.get(sessionId)?.tracker.getDetail(turnId) ?? null
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
    try {
      const shapedLine = line as Parameters<typeof categorizeLine>[0]
      // Turn boundary: a `user` line carrying user-authored text (not a
      // tool_result-only payload) opens a new turn. Close the previous one.
      if (isUserTextLine(shapedLine)) {
        if (state.currentTurnId > 0) {
          this.closeTurn(state)
        }
        state.currentTurnId += 1
        state.traceBuilder = new ExecutionTraceBuilder()
      }
      this.feedTraceBuilder(state, shapedLine)
      const hits = categorizeLine(shapedLine, state.detector, state.registry)
      if (hits.length === 0) return
      for (const h of hits) {
        const bucket = state.snapshot.buckets[h.category]
        bucket.tokens += h.tokens
        bucket.chars += h.chars
        bucket.itemCount += 1
        state.snapshot.total += h.tokens
        if (state.currentTurnId > 0) {
          state.tracker.recordItem(state.currentTurnId, h.category, {
            label: h.label ?? h.category,
            tokens: h.tokens,
            content: h.text
          })
        }
      }
      state.snapshot.updatedAt = Date.now()
      // Refresh turnDeltas pointer (cheap: same array reference, but include
      // a defensive copy of the latest summary into snapshot for IPC clone)
      state.snapshot.turnDeltas = state.tracker.getSummaries().slice()
      this.scheduleEmit(state)
    } catch (err) {
      this.reportError(state, err)
    }
  }

  private closeTurn(state: SessionState): void {
    if (state.currentTurnId <= 0) return
    state.tracker.closeTurn(state.currentTurnId, Date.now())
    if (state.traceBuilder) {
      const trace = state.traceBuilder.snapshot()
      if (trace.length > 0) {
        const summaries = state.tracker.getSummaries()
        const last = summaries[summaries.length - 1]
        if (last && last.turnId === state.currentTurnId) {
          last.trace = trace
        }
      }
      state.traceBuilder = null
    }
  }

  private feedTraceBuilder(state: SessionState, line: { type?: string; message?: { content?: unknown } }): void {
    if (!state.traceBuilder) return
    const content = line.message?.content
    if (!Array.isArray(content)) return
    if (line.type === 'assistant') {
      state.traceBuilder.recordAssistantBlocks(content as unknown[])
    } else if (line.type === 'user') {
      const tr = (content as Array<Record<string, unknown>>).filter((b) => b.type === 'tool_result')
      if (tr.length > 0) state.traceBuilder.recordToolResults(tr as unknown[])
    }
  }

  private reportError(state: SessionState, err: unknown): void {
    if (state.errorReported) return
    state.errorReported = true
    this.emit('error', err instanceof Error ? err : new Error(String(err)))
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
      mdLoaded: false,
      errorReported: false,
      tracker: new TurnDeltaTracker(),
      currentTurnId: 0,
      traceBuilder: null
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
