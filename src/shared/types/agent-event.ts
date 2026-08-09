import type { AgentProvider } from './agent-provider'
import type { AgentSessionStatus, ExternalSessionRef } from './agent-session'

export type AgentEventType =
  | 'status'
  | 'usage'
  | 'tool-activity'
  | 'reasoning'
  | 'compaction'
  | 'approval'
  | 'error'

export type AgentEventPayload =
  | { status: AgentSessionStatus }
  | {
      totalTokens?: number
      inputTokens?: number
      cachedInputTokens?: number
      outputTokens?: number
      reasoningOutputTokens?: number
      contextWindow?: number
    }
  | { toolName: string; state: 'started' | 'completed' | 'failed'; correlationId?: string }
  | { summaryCount?: number; hasOpaqueSignature?: boolean }
  | { source: string }
  | { approvalId: string; kind: string }
  | { message: string; recoverable: boolean }

/** Immutable normalized envelope. Provider-owned adapters create these events. */
export interface AgentEvent {
  eventId: string
  provider: AgentProvider
  session: ExternalSessionRef
  sequence: number
  timestamp: number
  type: AgentEventType
  payload: AgentEventPayload
}
