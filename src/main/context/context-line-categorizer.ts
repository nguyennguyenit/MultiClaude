import type { ContextCategory } from '@shared/types/context-window'
import { estimateTokens } from '@shared/utils/estimate-tokens'
import type { ContextMentionDetector } from './context-mention-detector'

/**
 * Tools whose input + result count as coordination traffic (subagents, tasks,
 * team comms) rather than regular tool-output.
 */
const COORD_TOOLS = new Set([
  'SendMessage',
  'TeamCreate',
  'TeamDelete',
  'TeamList',
  'TaskCreate',
  'TaskUpdate',
  'TaskList',
  'TaskGet',
  'TaskOutput',
  'TaskStop',
  'Task'
])

export interface CategoryHit {
  category: ContextCategory
  text: string
  chars: number
  tokens: number
}

export interface ToolUseRegistry {
  /** tool_use_id → tool name (populated when an assistant tool_use is seen). */
  get(id: string): string | undefined
  set(id: string, name: string): void
}

export function createToolUseRegistry(): ToolUseRegistry {
  const map = new Map<string, string>()
  return {
    get: (id) => map.get(id),
    set: (id, name) => { map.set(id, name) }
  }
}

interface JsonlLineShape {
  type?: string
  message?: {
    role?: string
    content?: unknown
  }
  attachment?: { type?: string; content?: unknown; stdout?: unknown }
}

function stringify(content: unknown): string {
  if (content == null) return ''
  if (typeof content === 'string') return content
  try {
    return JSON.stringify(content)
  } catch {
    return String(content)
  }
}

function hit(category: ContextCategory, text: string): CategoryHit {
  return {
    category,
    text,
    chars: text.length,
    tokens: estimateTokens(text)
  }
}

/**
 * Map one parsed JSONL line → 0..N CategoryHits. Pure apart from detector /
 * registry side-effects (mention correlation + tool-name tracking).
 */
export function categorizeLine(
  line: JsonlLineShape,
  detector: ContextMentionDetector,
  registry: ToolUseRegistry
): CategoryHit[] {
  const out: CategoryHit[] = []
  const type = line.type

  if (type === 'attachment') {
    // Harness-injected payloads (skill_listing, task_reminder, etc.) — all
    // bucket into claude-md per red-team M1.
    const a = line.attachment ?? {}
    const text = stringify(a.content) + stringify(a.stdout)
    if (text) out.push(hit('claude-md', text))
    return out
  }

  if (type === 'user') {
    const content = line.message?.content
    if (typeof content === 'string') {
      if (content.includes('<system-reminder>')) {
        out.push(hit('claude-md', content))
      } else {
        detector.recordUserText(content)
        out.push(hit('user-messages', content))
      }
      return out
    }
    if (Array.isArray(content)) {
      for (const block of content as Array<Record<string, unknown>>) {
        const btype = block.type
        if (btype === 'text') {
          const text = String(block.text ?? '')
          if (text.includes('<system-reminder>')) {
            out.push(hit('claude-md', text))
          } else {
            detector.recordUserText(text)
            out.push(hit('user-messages', text))
          }
        } else if (btype === 'tool_result') {
          const text = stringify(block.content)
          const toolId = String(block.tool_use_id ?? '')
          const toolName = registry.get(toolId)
          if (toolName && COORD_TOOLS.has(toolName)) {
            out.push(hit('task-coordination', text))
          } else if (toolName === 'Read' && detector.resolveToolResult(toolId) === 'mentioned') {
            out.push(hit('mentioned-file', text))
          } else {
            out.push(hit('tool-output', text))
          }
        }
      }
    }
    return out
  }

  if (type === 'assistant') {
    const content = line.message?.content
    if (!Array.isArray(content)) return out
    for (const block of content as Array<Record<string, unknown>>) {
      const btype = block.type
      if (btype === 'thinking') {
        const text = String(block.thinking ?? block.text ?? '')
        if (text) out.push(hit('thinking-text', text))
      } else if (btype === 'text') {
        const text = String(block.text ?? '')
        if (text) out.push(hit('thinking-text', text))
      } else if (btype === 'tool_use') {
        const id = String(block.id ?? '')
        const name = String(block.name ?? '')
        if (id && name) registry.set(id, name)
        detector.recordToolUse(id, name, block.input)
        const inputText = stringify(block.input)
        if (COORD_TOOLS.has(name) && inputText) {
          out.push(hit('task-coordination', inputText))
        }
      }
    }
    return out
  }

  return out
}
