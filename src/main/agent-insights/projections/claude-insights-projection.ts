import type { ExternalSessionRef } from '@shared/types'
import { EventInsightsProjection } from './event-insights-projection'

export class ClaudeInsightsProjection extends EventInsightsProjection {
  constructor(session: ExternalSessionRef, advancedEnabled = true) {
    super(session, {
      contextUsage: true,
      turnDeltas: false,
      toolActivity: advancedEnabled,
      compaction: advancedEnabled,
      reasoningMetadata: advancedEnabled,
    }, {
      precision: 'estimated',
      confidence: 'medium',
      source: 'claude-jsonl:message.usage',
    })
  }
}
