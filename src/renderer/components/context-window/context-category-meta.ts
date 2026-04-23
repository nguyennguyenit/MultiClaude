import type { ContextCategory } from '@shared/types'

export interface CategoryMeta {
  label: string
  /** CSS variable or direct color — rendered as the bar fill. */
  color: string
  /** Sort order in the drawer (top = smallest). */
  order: number
}

export const CATEGORY_META: Record<ContextCategory, CategoryMeta> = {
  'claude-md': { label: 'CLAUDE.md', color: 'var(--accent-purple, #a78bfa)', order: 1 },
  'mentioned-file': { label: 'Mentioned files', color: 'var(--accent-blue, #60a5fa)', order: 2 },
  'tool-output': { label: 'Tool output', color: 'var(--accent-cyan, #22d3ee)', order: 3 },
  'thinking-text': { label: 'Thinking + text', color: 'var(--accent-green, #4ade80)', order: 4 },
  'task-coordination': { label: 'Task coordination', color: 'var(--accent-orange, #fb923c)', order: 5 },
  'user-messages': { label: 'User messages', color: 'var(--accent-pink, #f472b6)', order: 6 }
}

/** Warn when total tokens cross this threshold (approximate 1M-ctx usage). */
export const CONTEXT_WARNING_THRESHOLD = 200_000
