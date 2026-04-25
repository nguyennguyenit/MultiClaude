import { useState } from 'react'
import type { ThinkingBlock } from '@shared/types'
import { formatTokens } from '@shared/utils/format-tokens'

interface Props {
  blocks: ThinkingBlock[]
  /** Optional count of older turns dropped from the FIFO window. */
  olderTruncatedCount?: number
}

export function ThinkingViewer({ blocks, olderTruncatedCount }: Props) {
  if (blocks.length === 0) {
    return (
      <div className="thinking-empty" data-testid="thinking-empty">
        Extended thinking is signed-only in Claude Code v2.1+ — text is not
        persisted in the JSONL stream. Counts will appear here once Claude
        produces thinking blocks.
      </div>
    )
  }
  const reversed = [...blocks].reverse()
  return (
    <div className="thinking-viewer">
      <h4 className="thinking-title">Extended thinking</h4>
      {olderTruncatedCount && olderTruncatedCount > 0 ? (
        <div className="thinking-truncated" data-testid="thinking-truncated">
          {olderTruncatedCount} older turns truncated.
        </div>
      ) : null}
      <ul className="thinking-rows">
        {reversed.map((b) => <ThinkingRow key={b.turnId} block={b} />)}
      </ul>
    </div>
  )
}

function ThinkingRow({ block }: { block: ThinkingBlock }) {
  const [open, setOpen] = useState(false)
  return (
    <li
      className={`thinking-row${open ? ' is-open' : ''}`}
      data-testid={`thinking-row-${block.turnId}`}
      onClick={() => setOpen((v) => !v)}
    >
      <span className="thinking-turn">#{block.turnId}</span>
      <span className="thinking-count">{block.count} block{block.count === 1 ? '' : 's'}</span>
      <span className="thinking-tokens">~{formatTokens(block.approxTokens)}</span>
      <span className="thinking-badge" title="Signature-only — text not persisted">🔒 signed</span>
      {open ? (
        <div className="thinking-detail">
          <p className="thinking-note">
            Signatures (first 16 chars). Full thinking text is not available in
            the JSONL feed for this CLI version.
          </p>
          <ul className="thinking-sig-list">
            {block.signatures.map((s, i) => (
              <li key={i} className="thinking-sig"><code>{s}…</code></li>
            ))}
          </ul>
        </div>
      ) : null}
    </li>
  )
}
