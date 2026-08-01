import { useState } from 'react'
import type { ToolActivityGroup } from '@shared/types'
import { formatTokens } from '@shared/utils/format-tokens'

interface Props {
  nodes: ToolActivityGroup[]
}

export function ExecutionTrace({ nodes }: Props) {
  if (nodes.length === 0) {
    return (
      <div className="exec-trace-empty" data-testid="exec-trace-empty">
        No tool activity in the most recent turn.
      </div>
    )
  }
  return (
    <div className="exec-trace">
      <h4 className="exec-trace-title">Tool activity</h4>
      <div className="exec-trace-rows" role="list">
        {nodes.map((n) => (
          <ExecutionNode key={n.id} node={n} />
        ))}
      </div>
    </div>
  )
}

function ExecutionNode({ node }: { node: ToolActivityGroup }) {
  const [open, setOpen] = useState(false)
  const observedCallCount = node.toolCalls.length + (node.omittedCallCount ?? 0)
  const label = `${observedCallCount} tool call${observedCallCount === 1 ? '' : 's'}`
  return (
    <div role="listitem" className="exec-trace-item">
      <button
        type="button"
        className={`exec-trace-row${open ? ' is-open' : ''}`}
        data-testid={`exec-trace-node-${node.id}`}
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        <span className="exec-trace-badge activity-tools">tools</span>
        <span className="exec-trace-label" title={label}>{label}</span>
        <span className="exec-trace-tokens">{formatTokens(node.tokens)}</span>
        {node.durationMs != null ? (
          <span className="exec-trace-duration">{Math.round(node.durationMs)}ms</span>
        ) : null}
      </button>
      {open && node.toolCalls.length > 0 ? (
        <ul className="exec-trace-tools">
          {node.toolCalls.map((c) => (
            <li key={c.id} className="exec-trace-tool">
              <span className="exec-trace-tool-name">{c.name}</span>
              <span className="exec-trace-tool-tokens">{formatTokens(c.tokens)}</span>
            </li>
          ))}
          {node.truncated && node.omittedCallCount ? (
            <li className="exec-trace-more">+{node.omittedCallCount} more (truncated)</li>
          ) : null}
        </ul>
      ) : null}
    </div>
  )
}
