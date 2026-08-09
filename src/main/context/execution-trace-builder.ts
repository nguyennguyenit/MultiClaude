import type { ToolActivityGroup, TraceToolCall } from '@shared/types/context-window'
import { estimateTokens } from '@shared/utils/estimate-tokens'

const ACTIVITY_ID = '__tools__'
const TOOL_CALL_CAP = 50

interface AssistantBlock {
  type?: string
  id?: string
  name?: string
  input?: Record<string, unknown>
  text?: string
}

interface ToolResultBlock {
  tool_use_id?: string
  content?: unknown
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

interface MutableNode {
  node: ToolActivityGroup
  /** Total observed calls omitted after the visible cap. */
  omittedCallCount: number
}

/**
 * Per-turn tool-activity builder. All observed tool invocations, including
 * `Agent`, stay in one flat ordered group. A nested execution trace is not
 * claimed because provider events do not expose a correlated inner stream.
 */
export class ExecutionTraceBuilder {
  private activityNode: MutableNode | null = null
  /** All observed nodes by tool_use_id for tool_result token attribution. */
  private readonly nodeByToolUseId = new Map<string, MutableNode>()

  recordAssistantBlocks(blocks: unknown[]): void {
    if (!Array.isArray(blocks)) return
    for (const raw of blocks) {
      if (!raw || typeof raw !== 'object') continue
      const block = raw as AssistantBlock
      if (block.type !== 'tool_use') continue
      const id = String(block.id ?? '')
      const name = String(block.name ?? '')
      if (!id || !name) continue

      const activity = this.ensureActivity()
      const inputTokens = block.input ? estimateTokens(stringify(block.input)) : 0
      activity.node.tokens += inputTokens
      if (activity.node.toolCalls.length >= TOOL_CALL_CAP) {
        activity.omittedCallCount += 1
        activity.node.truncated = true
        activity.node.omittedCallCount = activity.omittedCallCount
        // still register for token attribution even when not visible
        this.nodeByToolUseId.set(id, activity)
        continue
      }
      const call: TraceToolCall = { id, name, tokens: inputTokens }
      activity.node.toolCalls.push(call)
      this.nodeByToolUseId.set(id, activity)
    }
  }

  recordToolResults(blocks: unknown[]): void {
    if (!Array.isArray(blocks)) return
    for (const raw of blocks) {
      if (!raw || typeof raw !== 'object') continue
      const block = raw as ToolResultBlock
      const id = String(block.tool_use_id ?? '')
      if (!id) continue
      const target = this.nodeByToolUseId.get(id)
      if (!target) continue
      const tokens = estimateTokens(stringify(block.content))
      target.node.tokens += tokens
      const call = target.node.toolCalls.find((c) => c.id === id)
      if (call) call.tokens += tokens
    }
  }

  snapshot(): ToolActivityGroup[] {
    return this.activityNode ? [cloneNode(this.activityNode.node)] : []
  }

  private ensureActivity(): MutableNode {
    if (this.activityNode) return this.activityNode
    const node: ToolActivityGroup = {
      id: ACTIVITY_ID,
      tokens: 0,
      toolCalls: []
    }
    const mutable: MutableNode = { node, omittedCallCount: 0 }
    this.activityNode = mutable
    return mutable
  }
}

function cloneNode(n: ToolActivityGroup): ToolActivityGroup {
  return {
    ...n,
    toolCalls: n.toolCalls.map((c) => ({ ...c }))
  }
}
