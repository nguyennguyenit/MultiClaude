import type {
  AgentEvent,
  AgentInsightCapabilities,
  AgentInsightsSnapshot,
  ExternalSessionRef,
  InsightValue,
} from '@shared/types'

export interface AgentInsightsProjection {
  readonly session: ExternalSessionRef
  capabilities(): AgentInsightCapabilities
  apply(event: AgentEvent): void
  snapshot(): AgentInsightsSnapshot
  dispose(): void
}

export function unknownInsight<T>(source: string): InsightValue<T> {
  return {
    availability: 'unknown',
    precision: 'not-applicable',
    confidence: 'low',
    source,
  }
}

export function unavailableInsight<T>(source: string): InsightValue<T> {
  return {
    availability: 'unavailable',
    precision: 'not-applicable',
    confidence: 'high',
    source,
  }
}
