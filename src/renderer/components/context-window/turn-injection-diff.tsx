import { useCallback, useState } from 'react'
import type { TurnDeltaDetail, TurnDeltaSummary, ContextCategory } from '@shared/types'
import { CONTEXT_CATEGORIES } from '@shared/types'
import { formatTokens } from '@shared/utils/format-tokens'
import { CATEGORY_META } from './context-category-meta'

const SPIKE_THRESHOLD_TOKENS = 2000

interface Props {
  sessionId: string
  turns: TurnDeltaSummary[]
}

export function TurnInjectionDiff({ sessionId, turns }: Props) {
  const [expanded, setExpanded] = useState<Record<number, TurnDeltaDetail | 'loading' | undefined>>({})

  const toggle = useCallback(async (turnId: number) => {
    const cur = expanded[turnId]
    if (cur && cur !== 'loading') {
      setExpanded((m) => ({ ...m, [turnId]: undefined }))
      return
    }
    setExpanded((m) => ({ ...m, [turnId]: 'loading' }))
    const api = window.electron?.context
    const detail = api ? await api.getTurnDetail(sessionId, turnId) : null
    setExpanded((m) => ({ ...m, [turnId]: detail ?? undefined }))
  }, [expanded, sessionId])

  if (turns.length === 0) {
    return (
      <div className="turn-diff-empty" data-testid="turn-diff-empty">
        No turns recorded yet — start chatting to see per-turn deltas.
      </div>
    )
  }

  return (
    <div className="turn-diff" data-testid="turn-diff">
      <h4 className="turn-diff-title">Turn injection diff</h4>
      <div className="turn-diff-rows" role="list">
        {turns.map((t) => {
          const isSpike = t.totalDelta >= SPIKE_THRESHOLD_TOKENS
          const detail = expanded[t.turnId]
          const isOpen = !!detail && detail !== 'loading'
          return (
            <div key={t.turnId} role="listitem">
              <button
                type="button"
                className={`turn-diff-row${isSpike ? ' is-spike' : ''}${isOpen ? ' is-open' : ''}`}
                data-testid={`turn-diff-row-${t.turnId}`}
                onClick={() => void toggle(t.turnId)}
                aria-expanded={isOpen}
              >
                <span className="turn-diff-id">#{t.turnId}</span>
                <span className="turn-diff-total">+{formatTokens(t.totalDelta)}</span>
                <TurnSparkline summary={t} />
              </button>
              {detail === 'loading' ? (
                <div className="turn-diff-loading">Loading…</div>
              ) : isOpen ? (
                <TurnDetailBreakdown detail={detail as TurnDeltaDetail} />
              ) : null}
            </div>
          )
        })}
      </div>
    </div>
  )
}

function TurnSparkline({ summary }: { summary: TurnDeltaSummary }) {
  const total = summary.totalDelta || 1
  return (
    <span className="turn-diff-sparkline" aria-hidden>
      {CONTEXT_CATEGORIES.map((c) => {
        const v = summary.perCategoryTokens[c]
        if (v <= 0) return null
        const w = Math.max(2, Math.round((v / total) * 100))
        return (
          <span
            key={c}
            className="turn-diff-spark"
            style={{ width: `${w}%`, background: CATEGORY_META[c].color }}
          />
        )
      })}
    </span>
  )
}

function TurnDetailBreakdown({ detail }: { detail: TurnDeltaDetail }) {
  const sections = CONTEXT_CATEGORIES.flatMap((c) => {
    const d = detail.byCategory[c]
    if (!d || d.items.length === 0) return []
    return [{ category: c, ...d }]
  })
  if (sections.length === 0) {
    return <div className="turn-diff-detail-empty">No new items in this turn.</div>
  }
  return (
    <div className="turn-diff-detail">
      {sections.map((s) => (
        <DetailSection key={s.category} category={s.category} tokens={s.tokens} items={s.items} />
      ))}
    </div>
  )
}

interface DetailSectionProps {
  category: ContextCategory
  tokens: number
  items: TurnDeltaDetail['byCategory'][ContextCategory]['items']
}

function DetailSection({ category, tokens, items }: DetailSectionProps) {
  const meta = CATEGORY_META[category]
  return (
    <div className="turn-diff-cat">
      <div className="turn-diff-cat-header" style={{ borderLeftColor: meta.color }}>
        <span className="turn-diff-cat-label">{meta.label}</span>
        <span className="turn-diff-cat-tokens">+{formatTokens(tokens)}</span>
      </div>
      <ul className="turn-diff-items">
        {items.map((it) => (
          <li key={it.contentHash} className="turn-diff-item">
            <span className="turn-diff-item-label">{it.label}</span>
            <span className="turn-diff-item-tokens">+{formatTokens(it.tokens)}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}
