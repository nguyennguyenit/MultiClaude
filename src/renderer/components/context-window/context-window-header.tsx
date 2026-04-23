import { memo } from 'react'
import { CONTEXT_WARNING_THRESHOLD } from './context-category-meta'

interface Props {
  total: number
  sessionId: string | null
}

function formatTotal(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`
  return String(n)
}

function ContextWindowHeaderImpl({ total, sessionId }: Props) {
  const warning = total > CONTEXT_WARNING_THRESHOLD
  const sidShort = sessionId ? sessionId.slice(0, 8) : '—'
  return (
    <div className={`context-header${warning ? ' context-header-warn' : ''}`}>
      <div className="context-header-total">
        <span className="context-header-total-label">Total</span>
        <span className="context-header-total-value">{formatTotal(total)}</span>
        {warning && (
          <span className="context-header-warn-badge" title="Approaching context limit">!</span>
        )}
      </div>
      <div className="context-header-session" title={sessionId ?? undefined}>
        session: {sidShort}
      </div>
    </div>
  )
}

export const ContextWindowHeader = memo(ContextWindowHeaderImpl)
