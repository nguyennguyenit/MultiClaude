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
}

/**
 * One inner tool call grouped under a TraceNode (Read/Edit/Bash/etc).
 * Token count attributes the matching `tool_result` payload back to its
 * `tool_use_id`.
 */
export interface TraceToolCall {
  id: string
  name: string
  tokens: number
}

/**
 * Tree node for the execution-trace section. Fallback mode (no subagent
 * log co-watching) emits a single 'main' node aggregating all non-Agent
 * tool calls plus one 'subagent' node per `Agent` tool_use.
 */
export interface TraceNode {
  id: string
  agentType: 'main' | 'subagent'
  agentName?: string
  description?: string
  tokens: number
  durationMs?: number
  toolCalls: TraceToolCall[]
  children: TraceNode[]
  depthCapped?: boolean
  deeperCount?: number
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
   * Execution trace for this turn. Empty when no Agent or non-Agent tool
   * calls were observed. Populated only when the analyzer's tracker is on.
   */
  trace?: TraceNode[]
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
