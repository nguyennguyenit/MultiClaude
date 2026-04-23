import { memo } from 'react'

interface Props {
  label: string
  tokens: number
  pctOfTotal: number
  color: string
}

function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`
  return String(n)
}

function ContextCategoryRowImpl({ label, tokens, pctOfTotal, color }: Props) {
  const widthPct = Math.max(0, Math.min(100, pctOfTotal * 100))
  return (
    <div className="context-row">
      <div className="context-row-header">
        <span className="context-row-label">{label}</span>
        <span className="context-row-count">
          {formatTokens(tokens)}
          <span className="context-row-pct"> · {(pctOfTotal * 100).toFixed(1)}%</span>
        </span>
      </div>
      <div className="context-row-bar-track" aria-hidden>
        <div
          className="context-row-bar-fill"
          style={{ width: `${widthPct}%`, background: color }}
        />
      </div>
    </div>
  )
}

export const ContextCategoryRow = memo(ContextCategoryRowImpl)
