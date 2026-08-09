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
        No explicit compaction event has been observed.
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
  const time = new Date(event.timestamp).toLocaleTimeString()
  const sourceLabel = {
    summary: 'Explicit summary',
    'compact-boundary': 'Explicit compact boundary'
  }[event.source]
  const title = `Compaction (${sourceLabel.toLowerCase()}) at ${time}`
  return (
    <li
      className={`compaction-event conf-${event.confidence}${open ? ' is-open' : ''}`}
      data-testid={`compaction-event-${event.id}`}
      onClick={() => setOpen((v) => !v)}
      title={title}
    >
      <span className="compaction-marker" aria-hidden />
      <span className="compaction-time">{time}</span>
      <span className="compaction-source">{sourceLabel}</span>
      {event.observedTokens != null ? (
        <span className="compaction-observed">{formatTokens(event.observedTokens)} observed</span>
      ) : null}
      {open ? (
        <div className="compaction-detail">
          {event.summary ? <p className="compaction-summary">{event.summary}</p> : null}
          {event.compactedTurnCount != null ? (
            <p className="compaction-turn-count">{event.compactedTurnCount} turns folded</p>
          ) : null}
        </div>
      ) : null}
    </li>
  )
}
