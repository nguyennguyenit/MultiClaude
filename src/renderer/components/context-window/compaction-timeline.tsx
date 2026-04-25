import { useState } from 'react'
import type { CompactionEvent } from '@shared/types'
import { formatTokens } from '@shared/utils/format-tokens'

interface Props {
  events: CompactionEvent[]
}

export function CompactionTimeline({ events }: Props) {
  if (events.length === 0) {
    return (
      <div className="compaction-empty" data-testid="compaction-empty">
        No compaction events yet — the context window has not been folded.
      </div>
    )
  }
  return (
    <div className="compaction-timeline">
      <h4 className="compaction-title">Compaction events</h4>
      <ol className="compaction-rows">
        {events.map((e) => <CompactionRow key={e.id} event={e} />)}
      </ol>
    </div>
  )
}

function CompactionRow({ event }: { event: CompactionEvent }) {
  const [open, setOpen] = useState(false)
  const dropPct = event.beforeTokens > 0
    ? Math.round(((event.beforeTokens - event.afterTokens) / event.beforeTokens) * 100)
    : 0
  const time = new Date(event.timestamp).toLocaleTimeString()
  const title = `${event.confidence === 'high' ? 'Compaction' : 'Estimated compaction (unverified)'} at ${time}`
  return (
    <li
      className={`compaction-event conf-${event.confidence}${open ? ' is-open' : ''}`}
      data-testid={`compaction-event-${event.id}`}
      onClick={() => setOpen((v) => !v)}
      title={title}
    >
      <span className="compaction-marker" aria-hidden />
      <span className="compaction-time">{time}</span>
      <span className="compaction-delta">
        {formatTokens(event.beforeTokens)} → {formatTokens(event.afterTokens)}
      </span>
      <span className="compaction-drop">−{dropPct}%</span>
      {open ? (
        <div className="compaction-detail">
          {event.confidence === 'low' ? (
            <p className="compaction-note">Inferred from a sudden token drop. No explicit summary line was observed.</p>
          ) : null}
          {event.summary ? <p className="compaction-summary">{event.summary}</p> : null}
          {event.compactedTurnCount != null ? (
            <p className="compaction-turn-count">{event.compactedTurnCount} turns folded</p>
          ) : null}
        </div>
      ) : null}
    </li>
  )
}
