import { memo } from 'react'
import { formatTokens } from '@shared/utils/format-tokens'

interface Props {
  label: string
  tokens: number
  pctOfTotal: number
  color: string
  total: number
}

function ContextCategoryRowImpl({ label, tokens, pctOfTotal, color, total }: Props) {
  const widthPct = Math.max(0, Math.min(100, pctOfTotal * 100))
  const pctLabel = `${(pctOfTotal * 100).toFixed(1)}%`
  return (
    <div
      className="context-row"
      role="listitem"
      tabIndex={0}
      aria-label={`${label}: ${formatTokens(tokens)} tokens, ${pctLabel}`}
    >
      <div className="context-row-header">
        <span className="context-row-label">{label}</span>
        <span className="context-row-count">
          {formatTokens(tokens)}
          <span className="context-row-pct"> · {pctLabel}</span>
        </span>
      </div>
      <div
        className="context-row-bar-track"
        role="progressbar"
        aria-label={label}
        aria-valuenow={tokens}
        aria-valuemin={0}
        aria-valuemax={Math.max(total, tokens, 1)}
      >
        <div
          className="context-row-bar-fill"
          style={{ width: `${widthPct}%`, background: color }}
          aria-hidden
        />
      </div>
    </div>
  )
}

export const ContextCategoryRow = memo(ContextCategoryRowImpl)
