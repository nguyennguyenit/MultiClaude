import type { AgentProvider } from './agent-provider'
import type { ExternalSessionRef } from './agent-session'

export type InsightAvailability = 'available' | 'unavailable' | 'unknown'
export type InsightPrecision = 'exact' | 'estimated' | 'not-applicable'
export type InsightConfidence = 'high' | 'medium' | 'low'

export interface InsightValue<T> {
  value?: T
  availability: InsightAvailability
  precision: InsightPrecision
  confidence: InsightConfidence
  source: string
}

export interface AgentInsightCapabilities {
  contextUsage: boolean
  turnDeltas: boolean
  toolActivity: boolean
  compaction: boolean
  reasoningMetadata: boolean
}

export interface AgentUsageInsight {
  totalTokens?: number
  inputTokens?: number
  cachedInputTokens?: number
  outputTokens?: number
  reasoningOutputTokens?: number
  contextWindow?: number
}

export interface AgentToolActivityInsight {
  toolName: string
  state: 'started' | 'completed' | 'failed'
  correlationId?: string
  timestamp: number
}

export interface AgentReasoningInsight {
  summaryCount?: number
  hasOpaqueSignature?: boolean
}

export interface AgentCompactionInsight {
  source: string
  timestamp: number
}

export interface AgentInsightsSnapshot {
  provider: AgentProvider
  session: ExternalSessionRef
  updatedAt: number
  capabilities: AgentInsightCapabilities
  usage: InsightValue<AgentUsageInsight>
  turnDeltas: InsightValue<never[]>
  toolActivity: InsightValue<AgentToolActivityInsight[]>
  reasoning: InsightValue<AgentReasoningInsight>
  compactions: InsightValue<AgentCompactionInsight[]>
}
