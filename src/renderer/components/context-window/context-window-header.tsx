import { memo } from 'react'
import { formatTokens } from '@shared/utils/format-tokens'
import { CONTEXT_WARNING_THRESHOLD } from './context-category-meta'

interface Props {
  total: number
  sessionId: string | null
}

function ContextWindowHeaderImpl({ total, sessionId }: Props) {
  const warning = total > CONTEXT_WARNING_THRESHOLD
  const sidShort = sessionId ? sessionId.slice(0, 8) : '—'
  return (
    <div className={`context-header${warning ? ' context-header-warn' : ''}`}>
      <div className="context-header-total">
        <span className="context-header-total-label">Total</span>
        <span className="context-header-total-value">{formatTokens(total)}</span>
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
