/**
 * Per-turn context window breakdown taxonomy.
 *
 * Six categories covering every content block in a Claude Code JSONL transcript.
 * Hook-injected harness content (`<system-reminder>`, skill listings, etc.) is
 * merged into `claude-md` (see red-team decision M1 in the feature plan).
 */
export type ContextCategory =
  | 'claude-md'
  | 'mentioned-file'
  | 'tool-output'
  | 'thinking-text'
  | 'task-coordination'
  | 'user-messages'

export const CONTEXT_CATEGORIES: readonly ContextCategory[] = [
  'claude-md',
  'mentioned-file',
  'tool-output',
  'thinking-text',
  'task-coordination',
  'user-messages'
] as const

export interface CategoryBucket {
  /** Estimated token count (tiktoken o200k_base; chars/4 fallback). */
  tokens: number
  /** Raw UTF-16 character count of concatenated content in this bucket. */
  chars: number
  /** Number of distinct content hits attributed to this bucket. */
  itemCount: number
}

export interface ContextSnapshot {
  sessionId: string
  cwd?: string
  buckets: Record<ContextCategory, CategoryBucket>
  total: number
  updatedAt: number
  /**
   * Last N=50 per-turn delta summaries. Populated only when the analyzer's
   * turn tracker is enabled (i.e. user has the advanced flag ON). Undefined
   * means feature disabled / no turns observed yet.
   */
  turnDeltas?: TurnDeltaSummary[]
  /** Last 10 auto-compaction events for this session. */
  compactionEvents?: CompactionEvent[]
  /** Last 30 turns containing extended-thinking blocks. */
  thinkingBlocks?: ThinkingBlock[]
}

/**
 * Per-turn extended-thinking summary. Claude Code v2.1+ persists thinking
 * blocks signature-only (`thinking: ""` + `signature: <base64>`); we
 * report counts and a redacted signature prefix until CLI exposes text.
 */
export interface ThinkingBlock {
  turnId: number
  timestamp: number
  count: number
  /** First 16 chars of each block's signature, for traceability. */
  signatures: string[]
}

/**
 * Auto-compaction event backed by an explicit provider signal.
 * Token totals observed at the signal are context only; they do not claim
 * a before/after delta because the provider does not expose that boundary.
 */
export interface CompactionEvent {
  id: string
  timestamp: number
  observedTokens?: number
  /** Number of turns folded into the compact summary, when knowable. */
  compactedTurnCount?: number
  /** First N chars of the compact summary content. */
  summary?: string
  confidence: 'high'
  source: 'summary' | 'compact-boundary'
}

/**
 * One observed tool invocation (Read/Edit/Bash/Agent/etc.).
 * Token count attributes the matching `tool_result` payload back to its
 * `tool_use_id`.
 */
export interface TraceToolCall {
  id: string
  name: string
  tokens: number
}

/**
 * Flat per-turn tool activity group. `Agent` is an observed tool invocation;
 * it does not imply that a nested agent trace was joined or inspected.
 */
export interface ToolActivityGroup {
  id: string
  tokens: number
  durationMs?: number
  toolCalls: TraceToolCall[]
  truncated?: boolean
  /** Number of observed calls omitted from `toolCalls` after its cap. */
  omittedCallCount?: number
}

/** Lightweight per-turn summary streamed on the hot IPC channel (~300ms debounce). */
export interface TurnDeltaSummary {
  turnId: number
  /** Wall-clock when the turn closed (ms since epoch). */
  timestamp: number
  /** Sum of perCategoryTokens; convenience field for renderer. */
  totalDelta: number
  perCategoryTokens: Record<ContextCategory, number>
  /**
   * Tool activity for this turn. The `trace` field name is retained for IPC
   * compatibility; its payload is flat. Empty when no tool calls were observed.
   * Populated only when the analyzer's tracker is on.
   */
  trace?: ToolActivityGroup[]
}

/** One newly-injected item within a category for a turn. */
export interface CategoryDeltaItem {
  label: string
  tokens: number
  path?: string
  /** 16-char hex digest of content for dedup. FNV-1a 64-bit. */
  contentHash: string
}

export interface CategoryDelta {
  tokens: number
  items: CategoryDeltaItem[]
}

/** Detailed payload requested via cold IPC channel on row expand. */
export interface TurnDeltaDetail {
  turnId: number
  byCategory: Record<ContextCategory, CategoryDelta>
}

export function emptyBuckets(): Record<ContextCategory, CategoryBucket> {
  return {
    'claude-md': { tokens: 0, chars: 0, itemCount: 0 },
    'mentioned-file': { tokens: 0, chars: 0, itemCount: 0 },
    'tool-output': { tokens: 0, chars: 0, itemCount: 0 },
    'thinking-text': { tokens: 0, chars: 0, itemCount: 0 },
    'task-coordination': { tokens: 0, chars: 0, itemCount: 0 },
    'user-messages': { tokens: 0, chars: 0, itemCount: 0 }
  }
}
