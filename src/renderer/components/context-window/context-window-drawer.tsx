import { useMemo } from 'react'
import { SlidePanel } from '../slide-panel'
import { useAppStore, useContextWindowStore, useSettingsStore } from '../../stores'
import { useContextSnapshot } from '../../hooks/use-context-snapshot'
import { CATEGORY_META } from './context-category-meta'
import { ContextCategoryRow } from './context-category-row'
import { ContextWindowHeader } from './context-window-header'
import { PaneSwitcherHeader } from './pane-switcher-header'
import { TurnInjectionDiff } from './turn-injection-diff'
import { ExecutionTrace } from './execution-trace'
import { CompactionTimeline } from './compaction-timeline'
import { ThinkingViewer } from './thinking-viewer'
import { AgentInsightsSummary } from './agent-insights-summary'
import type { ContextCategory } from '@shared/types'

const ORDERED_CATEGORIES: ContextCategory[] = (Object.keys(CATEGORY_META) as ContextCategory[])
  .sort((a, b) => CATEGORY_META[a].order - CATEGORY_META[b].order)

export function ContextWindowDrawer() {
  const isOpen = useContextWindowStore((s) => s.isOpen)
  const setOpen = useContextWindowStore((s) => s.setOpen)
  const advancedEnabled = useSettingsStore((s) => s.settings.enableContextWindowAdvanced ?? false)

  const activeSessionId = useAppStore((s) => {
    const t = s.terminals.find((x) => x.id === s.activeTerminalId)
    return t?.claudeSessionId ?? null
  })
  const activeBinding = useAppStore((s) =>
    s.activeTerminalId ? s.agentBindings[s.activeTerminalId] : undefined
  )
  const managedSnapshot = useContextWindowStore((s) => activeBinding
    ? s.insightSnapshots[`${activeBinding.session.provider}:${activeBinding.session.id}`]
    : undefined
  )

  const { snapshot: snap, isStale } = useContextSnapshot(activeSessionId)
  const total = snap?.total ?? 0

  const rows = useMemo(() => {
    if (!snap) return []
    return ORDERED_CATEGORIES.map((cat) => {
      const bucket = snap.buckets[cat]
      const meta = CATEGORY_META[cat]
      return {
        key: cat,
        label: meta.label,
        color: meta.color,
        tokens: bucket.tokens,
        pctOfTotal: total > 0 ? bucket.tokens / total : 0
      }
    })
  }, [snap, total])

  const staleChip = isStale ? (
    <span
      className="context-stale-chip"
      data-testid="context-stale-chip"
      title="No update for >10s — feed may be stalled"
    >
      Stale
    </span>
  ) : null

  return (
    <SlidePanel
      isOpen={isOpen}
      onClose={() => setOpen(false)}
      title="Agent Insights"
      headerExtra={staleChip}
    >
      <aside
        role="complementary"
        aria-label="Agent insights and context window breakdown"
        className="context-window-body"
        data-testid="context-window-body"
      >
        {advancedEnabled ? <PaneSwitcherHeader /> : null}
        {activeBinding && !managedSnapshot ? (
          <div className="context-empty" data-testid="context-empty">
            Waiting for {activeBinding.session.provider} insight events.
          </div>
        ) : activeBinding?.session.provider === 'codex' && managedSnapshot ? (
          <AgentInsightsSummary snapshot={managedSnapshot} advancedEnabled={advancedEnabled} />
        ) : !activeSessionId || !snap ? (
          <div className="context-empty" data-testid="context-empty">
            No managed Claude or Codex session in the active pane yet.
          </div>
        ) : (
          <>
            {managedSnapshot ? (
              <AgentInsightsSummary snapshot={managedSnapshot} advancedEnabled={false} />
            ) : null}
            <ContextWindowHeader total={total} sessionId={activeSessionId} />
            <div className="context-rows" role="list">
              {rows.map((r) => (
                <ContextCategoryRow
                  key={r.key}
                  label={r.label}
                  tokens={r.tokens}
                  pctOfTotal={r.pctOfTotal}
                  color={r.color}
                  total={total}
                />
              ))}
            </div>
            {advancedEnabled ? (
              <>
                <TurnInjectionDiff sessionId={activeSessionId} turns={snap.turnDeltas ?? []} />
                <ExecutionTrace
                  nodes={snap.turnDeltas?.[snap.turnDeltas.length - 1]?.trace ?? []}
                />
                <CompactionTimeline events={snap.compactionEvents ?? []} />
                <ThinkingViewer blocks={snap.thinkingBlocks ?? []} />
              </>
            ) : null}
          </>
        )}
      </aside>
    </SlidePanel>
  )
}
