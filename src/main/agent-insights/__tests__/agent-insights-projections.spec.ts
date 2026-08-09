import { describe, expect, it } from 'vitest'

import type { AgentEvent, ExternalSessionRef } from '@shared/types'
import { ClaudeInsightsProjection } from '../projections/claude-insights-projection'
import { CodexInsightsProjection } from '../projections/codex-insights-projection'

function event(
  session: ExternalSessionRef,
  sequence: number,
  type: AgentEvent['type'],
  payload: AgentEvent['payload']
): AgentEvent {
  return {
    eventId: `${session.provider}:${sequence}`,
    provider: session.provider,
    session,
    sequence,
    timestamp: 100 + sequence,
    type,
    payload,
  }
}

describe('agent insight projections', () => {
  it('labels Claude usage as estimated and never invents unavailable parity', () => {
    const session = { provider: 'claude', id: 'session-1' } as const
    const projection = new ClaudeInsightsProjection(session)
    projection.apply(event(session, 1, 'usage', { inputTokens: 100, outputTokens: 20 }))
    projection.apply(event(session, 2, 'reasoning', {
      summaryCount: 2,
      hasOpaqueSignature: true,
    }))

    const snapshot = projection.snapshot()
    expect(snapshot.usage).toMatchObject({
      availability: 'available',
      precision: 'estimated',
      confidence: 'medium',
      source: 'claude-jsonl:message.usage',
      value: { inputTokens: 100, outputTokens: 20 },
    })
    expect(snapshot.turnDeltas.availability).toBe('unavailable')
    expect(snapshot.reasoning.value).toEqual({ summaryCount: 2, hasOpaqueSignature: true })
    expect(snapshot.reasoning.value).not.toHaveProperty('approxTokens')
  })

  it('keeps Codex native fields exact and explicit compaction/tool metadata flat', () => {
    const session = { provider: 'codex', id: 'thread-1' } as const
    const projection = new CodexInsightsProjection(session)
    projection.apply(event(session, 1, 'usage', {
      totalTokens: 120,
      inputTokens: 90,
      cachedInputTokens: 30,
      outputTokens: 30,
      reasoningOutputTokens: 10,
      contextWindow: 200_000,
    }))
    projection.apply(event(session, 2, 'tool-activity', {
      toolName: 'commandExecution',
      state: 'started',
      correlationId: 'item-1',
    }))
    projection.apply(event(session, 3, 'compaction', {
      source: 'codex-app-server:thread/compacted',
    }))

    const snapshot = projection.snapshot()
    expect(snapshot.usage).toMatchObject({
      availability: 'available',
      precision: 'exact',
      confidence: 'high',
      value: { totalTokens: 120, cachedInputTokens: 30, contextWindow: 200_000 },
    })
    expect(snapshot.toolActivity.value).toEqual([{
      toolName: 'commandExecution',
      state: 'started',
      correlationId: 'item-1',
      timestamp: 102,
    }])
    expect(snapshot.compactions.value).toEqual([{
      source: 'codex-app-server:thread/compacted',
      timestamp: 103,
    }])
  })

  it('ignores corrupt or cross-session events without converting them to zeros', () => {
    const session = { provider: 'codex', id: 'thread-1' } as const
    const projection = new CodexInsightsProjection(session)
    projection.apply(event({ provider: 'codex', id: 'other' }, 1, 'usage', { totalTokens: 0 }))
    projection.apply(event(session, 2, 'usage', { totalTokens: Number.NaN }))

    expect(projection.snapshot().usage).toMatchObject({
      availability: 'unknown',
      value: undefined,
    })
  })

  it('does not accumulate advanced metadata when advanced insights are disabled', () => {
    const session = { provider: 'codex', id: 'thread-1' } as const
    const projection = new CodexInsightsProjection(session, false)
    projection.apply(event(session, 1, 'tool-activity', {
      toolName: 'commandExecution',
      state: 'started',
    }))
    projection.apply(event(session, 2, 'reasoning', { summaryCount: 1 }))
    projection.apply(event(session, 3, 'compaction', { source: 'explicit' }))

    const snapshot = projection.snapshot()
    expect(snapshot.capabilities).toMatchObject({
      toolActivity: false,
      reasoningMetadata: false,
      compaction: false,
    })
    expect(snapshot.toolActivity).toMatchObject({ availability: 'unavailable', value: undefined })
    expect(snapshot.reasoning).toMatchObject({ availability: 'unavailable', value: undefined })
    expect(snapshot.compactions).toMatchObject({ availability: 'unavailable', value: undefined })
  })
})
