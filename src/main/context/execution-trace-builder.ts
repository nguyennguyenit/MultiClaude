import type { TraceNode, TraceToolCall } from '@shared/types/context-window'
import { estimateTokens } from '@shared/utils/estimate-tokens'

const MAIN_ID = '__main__'
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
  node: TraceNode
  /** Total raw deeper-call count before cap. */
  deeperCount: number
}

/**
 * Per-turn execution-trace builder. Fallback mode (no subagent log
 * co-watching): emits a single 'main' node aggregating non-Agent tool
 * calls + one 'subagent' node per `Agent` tool_use. Children depth = 0
 * because we cannot resolve the inner trace of a subagent without
 * watching its log.
 */
export class ExecutionTraceBuilder {
  private mainNode: MutableNode | null = null
  private readonly subagents = new Map<string, MutableNode>()
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

      if (name === 'Agent') {
        const input = (block.input ?? {}) as { subagent_type?: string; description?: string; prompt?: string }
        const promptTokens = input.prompt ? estimateTokens(String(input.prompt)) : 0
        const node: TraceNode = {
          id,
          agentType: 'subagent',
          agentName: input.subagent_type ?? 'agent',
          description: input.description,
          tokens: promptTokens,
          toolCalls: [],
          children: []
        }
        const mutable: MutableNode = { node, deeperCount: 0 }
        this.subagents.set(id, mutable)
        this.nodeByToolUseId.set(id, mutable)
        continue
      }

      const main = this.ensureMain()
      if (main.node.toolCalls.length >= TOOL_CALL_CAP) {
        main.deeperCount += 1
        main.node.depthCapped = true
        main.node.deeperCount = main.deeperCount
        // still register for token attribution even when not visible
        this.nodeByToolUseId.set(id, main)
        continue
      }
      const inputTokens = block.input ? estimateTokens(stringify(block.input)) : 0
      const call: TraceToolCall = { id, name, tokens: inputTokens }
      main.node.toolCalls.push(call)
      main.node.tokens += inputTokens
      this.nodeByToolUseId.set(id, main)
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
      // Add to the matching tool call's tokens if it's a main node entry
      if (target.node.agentType === 'main') {
        const call = target.node.toolCalls.find((c) => c.id === id)
        if (call) call.tokens += tokens
      }
    }
  }

  snapshot(): TraceNode[] {
    const out: TraceNode[] = []
    if (this.mainNode) out.push(cloneNode(this.mainNode.node))
    for (const m of this.subagents.values()) out.push(cloneNode(m.node))
    return out
  }

  private ensureMain(): MutableNode {
    if (this.mainNode) return this.mainNode
    const node: TraceNode = {
      id: MAIN_ID,
      agentType: 'main',
      agentName: 'main',
      tokens: 0,
      toolCalls: [],
      children: []
    }
    const mutable: MutableNode = { node, deeperCount: 0 }
    this.mainNode = mutable
    return mutable
  }
}

function cloneNode(n: TraceNode): TraceNode {
  return {
    ...n,
    toolCalls: n.toolCalls.map((c) => ({ ...c })),
    children: n.children.map(cloneNode)
  }
}
