import type { ReactNode } from 'react'
import type { AgentInsightsSnapshot, InsightAvailability } from '@shared/types'

interface AgentInsightsSummaryProps {
  snapshot: AgentInsightsSnapshot
  advancedEnabled: boolean
}

function unavailable(label: string, source: string): ReactNode {
  return <p className="context-empty">{label} is unavailable ({source}).</p>
}

function missingInsight(
  label: string,
  availability: InsightAvailability,
  source: string
): ReactNode {
  return availability === 'unknown'
    ? <p className="context-muted">{label} has not been observed yet ({source}).</p>
    : unavailable(label, source)
}

export function AgentInsightsSummary({ snapshot, advancedEnabled }: AgentInsightsSummaryProps) {
  const usage = snapshot.usage.value
  const total = usage?.totalTokens
    ?? ((usage?.inputTokens ?? 0) + (usage?.outputTokens ?? 0) || undefined)
  const usageText = total === undefined
    ? undefined
    : usage?.contextWindow
      ? `${total.toLocaleString()} / ${usage.contextWindow.toLocaleString()} tokens`
      : `${total.toLocaleString()} tokens`

  return (
    <section aria-label={`${snapshot.provider} agent insights`} className="agent-insights-summary">
      <h3>{snapshot.provider === 'claude' ? 'Claude' : 'Codex'} Agent Insights</h3>
      {snapshot.usage.availability === 'available' && usageText ? (
        <div>
          <strong>{usageText}</strong>
          <div className="context-muted">
            {snapshot.usage.precision} · {snapshot.usage.confidence} confidence · {snapshot.usage.source}
          </div>
        </div>
      ) : missingInsight('Context usage', snapshot.usage.availability, snapshot.usage.source)}

      {advancedEnabled ? (
        <>
          <h3>Tool Activity</h3>
          {snapshot.capabilities.toolActivity ? (
            snapshot.toolActivity.value?.length ? (
              <ul>
                {snapshot.toolActivity.value.map((activity, index) => (
                  <li key={`${activity.correlationId ?? activity.toolName}:${activity.timestamp}:${index}`}>
                    {activity.toolName} — {activity.state}
                  </li>
                ))}
              </ul>
            ) : <p className="context-muted">No tool activity observed.</p>
          ) : unavailable('Tool activity', snapshot.toolActivity.source)}

          {!snapshot.capabilities.turnDeltas
            ? unavailable('Turn injection diff', snapshot.turnDeltas.source)
            : null}

          <h3>Reasoning metadata</h3>
          {snapshot.reasoning.availability === 'available' ? (
            <p>
              {snapshot.reasoning.value?.summaryCount ?? 0} summary block(s)
              {snapshot.reasoning.value?.hasOpaqueSignature ? ' · opaque signature present' : ''}
            </p>
          ) : missingInsight(
            'Reasoning metadata',
            snapshot.reasoning.availability,
            snapshot.reasoning.source
          )}

          <h3>Compaction</h3>
          {snapshot.compactions.value?.length ? (
            <ul>
              {snapshot.compactions.value.map((entry, index) => (
                <li key={`${entry.timestamp}:${index}`}>{entry.source}</li>
              ))}
            </ul>
          ) : <p className="context-muted">No explicit compaction observed.</p>}
        </>
      ) : null}
    </section>
  )
}
