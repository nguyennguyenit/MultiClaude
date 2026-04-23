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
