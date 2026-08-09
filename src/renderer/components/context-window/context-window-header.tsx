import { memo } from 'react'
import { formatTokens } from '@shared/utils/format-tokens'

interface Props {
  total: number
  sessionId: string | null
}

function ContextWindowHeaderImpl({ total, sessionId }: Props) {
  const sidShort = sessionId ? sessionId.slice(0, 8) : '—'
  return (
    <div className="context-header">
      <div className="context-header-total">
        <span className="context-header-total-label">Cumulative estimate</span>
        <span
          className="context-header-total-value"
          title="Estimated from categorized transcript content; not provider-reported active context usage"
        >
          ~{formatTokens(total)}
        </span>
      </div>
      <div className="context-header-session" title={sessionId ?? undefined}>
        session: {sidShort}
      </div>
    </div>
  )
}

export const ContextWindowHeader = memo(ContextWindowHeaderImpl)
