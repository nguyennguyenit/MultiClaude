import { useState } from 'react'
import type { TraceNode } from '@shared/types'
import { formatTokens } from '@shared/utils/format-tokens'

interface Props {
  nodes: TraceNode[]
}

export function ExecutionTrace({ nodes }: Props) {
  if (nodes.length === 0) {
    return (
      <div className="exec-trace-empty" data-testid="exec-trace-empty">
        No subagent or tool activity in the most recent turn.
      </div>
    )
  }
  return (
    <div className="exec-trace">
      <h4 className="exec-trace-title">Execution trace</h4>
      <div className="exec-trace-rows" role="list">
        {nodes.map((n) => (
          <ExecutionNode key={n.id} node={n} />
        ))}
      </div>
    </div>
  )
}

function ExecutionNode({ node }: { node: TraceNode }) {
  const [open, setOpen] = useState(false)
  const isMain = node.agentType === 'main'
  const label = isMain ? `${node.toolCalls.length} tool calls` : (node.description ?? node.agentName ?? 'subagent')
  return (
    <div role="listitem" className="exec-trace-item">
      <button
        type="button"
        className={`exec-trace-row${open ? ' is-open' : ''}`}
        data-testid={`exec-trace-node-${node.id}`}
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        <span className={`exec-trace-badge agent-${node.agentType}`}>
          {node.agentName ?? node.agentType}
        </span>
        <span className="exec-trace-label" title={label}>{label}</span>
        <span className="exec-trace-tokens">{formatTokens(node.tokens)}</span>
        {node.durationMs != null ? (
          <span className="exec-trace-duration">{Math.round(node.durationMs)}ms</span>
        ) : null}
      </button>
      {open && isMain && node.toolCalls.length > 0 ? (
        <ul className="exec-trace-tools">
          {node.toolCalls.map((c) => (
            <li key={c.id} className="exec-trace-tool">
              <span className="exec-trace-tool-name">{c.name}</span>
              <span className="exec-trace-tool-tokens">{formatTokens(c.tokens)}</span>
            </li>
          ))}
          {node.depthCapped && node.deeperCount ? (
            <li className="exec-trace-more">+{node.deeperCount} more (truncated)</li>
          ) : null}
        </ul>
      ) : null}
      {open && !isMain ? (
        <div className="exec-trace-subnote">
          Subagent inner trace not co-watched yet — open the agent log under
          <code> ~/.claude/projects/{'<'}sessionId{'>'}/subagents/</code> for details.
        </div>
      ) : null}
    </div>
  )
}
