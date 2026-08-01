import type { ExternalSessionRef } from '@shared/types'
import { EventInsightsProjection } from './event-insights-projection'

export class CodexInsightsProjection extends EventInsightsProjection {
  constructor(session: ExternalSessionRef, advancedEnabled = true) {
    super(session, {
      contextUsage: true,
      turnDeltas: false,
      toolActivity: advancedEnabled,
      compaction: advancedEnabled,
      reasoningMetadata: advancedEnabled,
    }, {
      precision: 'exact',
      confidence: 'high',
      source: 'codex-app-server:thread/tokenUsage/updated',
    })
  }
}
