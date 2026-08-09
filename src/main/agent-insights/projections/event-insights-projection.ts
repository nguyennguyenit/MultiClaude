import type {
  AgentCompactionInsight,
  AgentEvent,
  AgentInsightCapabilities,
  AgentInsightsSnapshot,
  AgentReasoningInsight,
  AgentToolActivityInsight,
  AgentUsageInsight,
  ExternalSessionRef,
  InsightConfidence,
  InsightPrecision,
  InsightValue,
} from '@shared/types'
import type { AgentInsightsProjection } from '../agent-insights-projection'
import { unavailableInsight, unknownInsight } from '../agent-insights-projection'

function record(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === 'object' ? value as Record<string, unknown> : undefined
}

function finite(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : undefined
}

export abstract class EventInsightsProjection implements AgentInsightsProjection {
  protected usage: InsightValue<AgentUsageInsight>
  protected reasoning: InsightValue<AgentReasoningInsight>
  protected toolActivity: InsightValue<AgentToolActivityInsight[]>
  protected compactions: InsightValue<AgentCompactionInsight[]>
  protected updatedAt = 0

  constructor(
    readonly session: ExternalSessionRef,
    private readonly ownedCapabilities: AgentInsightCapabilities,
    private readonly usageMetadata: {
      precision: InsightPrecision
      confidence: InsightConfidence
      source: string
    }
  ) {
    this.usage = unknownInsight(usageMetadata.source)
    this.reasoning = ownedCapabilities.reasoningMetadata
      ? unknownInsight(`${session.provider}:normalized-reasoning`)
      : unavailableInsight(`${session.provider}:unsupported`)
    this.toolActivity = ownedCapabilities.toolActivity
      ? { ...unknownInsight(`${session.provider}:normalized-tool-activity`), value: [] }
      : unavailableInsight(`${session.provider}:unsupported`)
    this.compactions = ownedCapabilities.compaction
      ? { ...unknownInsight(`${session.provider}:explicit-compaction`), value: [] }
      : unavailableInsight(`${session.provider}:unsupported`)
  }

  capabilities(): AgentInsightCapabilities {
    return { ...this.ownedCapabilities }
  }

  apply(event: AgentEvent): void {
    if (
      event.provider !== this.session.provider
      || event.session.provider !== this.session.provider
      || event.session.id !== this.session.id
    ) return
    const payload = record(event.payload)
    if (!payload) return

    if (event.type === 'usage') {
      const value: AgentUsageInsight = {
        totalTokens: finite(payload.totalTokens),
        inputTokens: finite(payload.inputTokens),
        cachedInputTokens: finite(payload.cachedInputTokens),
        outputTokens: finite(payload.outputTokens),
        reasoningOutputTokens: finite(payload.reasoningOutputTokens),
        contextWindow: finite(payload.contextWindow),
      }
      const available = Object.fromEntries(
        Object.entries(value).filter((entry): entry is [string, number] => entry[1] !== undefined)
      ) as AgentUsageInsight
      if (Object.keys(available).length === 0) return
      this.usage = {
        value: available,
        availability: 'available',
        ...this.usageMetadata,
      }
    } else if (event.type === 'reasoning') {
      if (!this.ownedCapabilities.reasoningMetadata) return
      const summaryCount = finite(payload.summaryCount)
      const hasOpaqueSignature = typeof payload.hasOpaqueSignature === 'boolean'
        ? payload.hasOpaqueSignature
        : undefined
      if (summaryCount === undefined && hasOpaqueSignature === undefined) return
      this.reasoning = {
        value: { summaryCount, hasOpaqueSignature },
        availability: 'available',
        precision: 'exact',
        confidence: 'high',
        source: `${this.session.provider}:normalized-reasoning`,
      }
    } else if (event.type === 'tool-activity') {
      if (!this.ownedCapabilities.toolActivity) return
      if (typeof payload.toolName !== 'string' || !payload.toolName) return
      if (!['started', 'completed', 'failed'].includes(String(payload.state))) return
      this.toolActivity = {
        value: [
          ...(this.toolActivity.value ?? []),
          {
            toolName: payload.toolName,
            state: payload.state as AgentToolActivityInsight['state'],
            ...(typeof payload.correlationId === 'string' ? { correlationId: payload.correlationId } : {}),
            timestamp: event.timestamp,
          },
        ].slice(-200),
        availability: 'available',
        precision: 'exact',
        confidence: 'high',
        source: `${this.session.provider}:normalized-tool-activity`,
      }
    } else if (event.type === 'compaction') {
      if (!this.ownedCapabilities.compaction) return
      if (typeof payload.source !== 'string' || !payload.source) return
      this.compactions = {
        value: [...(this.compactions.value ?? []), { source: payload.source, timestamp: event.timestamp }].slice(-100),
        availability: 'available',
        precision: 'exact',
        confidence: 'high',
        source: payload.source,
      }
    } else {
      return
    }
    this.updatedAt = Math.max(this.updatedAt, event.timestamp)
  }

  snapshot(): AgentInsightsSnapshot {
    return {
      provider: this.session.provider,
      session: { ...this.session },
      updatedAt: this.updatedAt,
      capabilities: this.capabilities(),
      usage: { ...this.usage, value: this.usage.value && { ...this.usage.value } },
      turnDeltas: unavailableInsight(`${this.session.provider}:turn-deltas-unavailable`),
      toolActivity: { ...this.toolActivity, value: this.toolActivity.value?.map(value => ({ ...value })) },
      reasoning: { ...this.reasoning, value: this.reasoning.value && { ...this.reasoning.value } },
      compactions: { ...this.compactions, value: this.compactions.value?.map(value => ({ ...value })) },
    }
  }

  dispose(): void {
    this.toolActivity = { ...this.toolActivity, value: [] }
    this.compactions = { ...this.compactions, value: [] }
  }
}
