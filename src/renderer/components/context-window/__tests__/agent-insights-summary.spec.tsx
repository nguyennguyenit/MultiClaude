// @vitest-environment jsdom
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import type { AgentInsightsSnapshot } from '@shared/types'
import { AgentInsightsSummary } from '../agent-insights-summary'

function snapshot(): AgentInsightsSnapshot {
  return {
    provider: 'codex',
    session: { provider: 'codex', id: 'thread-1' },
    updatedAt: 1,
    capabilities: {
      contextUsage: true,
      turnDeltas: false,
      toolActivity: true,
      compaction: true,
      reasoningMetadata: true,
    },
    usage: {
      value: { totalTokens: 120, contextWindow: 200_000 },
      availability: 'available',
      precision: 'exact',
      confidence: 'high',
      source: 'codex-app-server:thread/tokenUsage/updated',
    },
    turnDeltas: { availability: 'unavailable', precision: 'not-applicable', confidence: 'high', source: 'codex:unsupported' },
    toolActivity: {
      value: [{ toolName: 'commandExecution', state: 'started', timestamp: 1 }],
      availability: 'available',
      precision: 'exact',
      confidence: 'high',
      source: 'codex:normalized-tool-activity',
    },
    reasoning: { availability: 'unknown', precision: 'not-applicable', confidence: 'low', source: 'codex:normalized-reasoning' },
    compactions: { value: [], availability: 'unknown', precision: 'not-applicable', confidence: 'low', source: 'codex:explicit-compaction' },
  }
}

describe('AgentInsightsSummary', () => {
  it('renders exact provider-native usage and capability-aware unavailable sections', () => {
    render(<AgentInsightsSummary snapshot={snapshot()} advancedEnabled />)

    expect(screen.getByText('120 / 200,000 tokens')).toBeTruthy()
    expect(screen.getByText(/exact · high confidence/i)).toBeTruthy()
    expect(screen.getByText('Tool Activity')).toBeTruthy()
    expect(screen.getByText(/commandExecution/)).toBeTruthy()
    expect(screen.getByText(/Turn injection diff is unavailable/i)).toBeTruthy()
    expect(screen.getByText(/Reasoning metadata has not been observed yet/i)).toBeTruthy()
  })
})
