import { useMemo } from 'react'
import { SlidePanel } from '../slide-panel'
import { useAppStore, useContextWindowStore } from '../../stores'
import { useContextSnapshot } from '../../hooks/use-context-snapshot'
import { CATEGORY_META } from './context-category-meta'
import { ContextCategoryRow } from './context-category-row'
import { ContextWindowHeader } from './context-window-header'
import type { ContextCategory } from '@shared/types'

const ORDERED_CATEGORIES: ContextCategory[] = (Object.keys(CATEGORY_META) as ContextCategory[])
  .sort((a, b) => CATEGORY_META[a].order - CATEGORY_META[b].order)

export function ContextWindowDrawer() {
  const isOpen = useContextWindowStore((s) => s.isOpen)
  const setOpen = useContextWindowStore((s) => s.setOpen)

  const activeSessionId = useAppStore((s) => {
    const t = s.terminals.find((x) => x.id === s.activeTerminalId)
    return t?.claudeSessionId ?? null
  })

  const snap = useContextSnapshot(activeSessionId)
  const total = snap?.total ?? 0

  const rows = useMemo(() => {
    if (!snap) return []
    return ORDERED_CATEGORIES.map((cat) => {
      const bucket = snap.buckets[cat]
      const meta = CATEGORY_META[cat]
      return {
        key: cat,
        label: meta.label,
        color: meta.color,
        tokens: bucket.tokens,
        pctOfTotal: total > 0 ? bucket.tokens / total : 0
      }
    })
  }, [snap, total])

  return (
    <SlidePanel
      isOpen={isOpen}
      onClose={() => setOpen(false)}
      title="Context window"
    >
      <div className="context-window-body" data-testid="context-window-body">
        {!activeSessionId || !snap ? (
          <div className="context-empty" data-testid="context-empty">
            No Claude session in the active pane yet.
          </div>
        ) : (
          <>
            <ContextWindowHeader total={total} sessionId={activeSessionId} />
            <div className="context-rows">
              {rows.map((r) => (
                <ContextCategoryRow
                  key={r.key}
                  label={r.label}
                  tokens={r.tokens}
                  pctOfTotal={r.pctOfTotal}
                  color={r.color}
                />
              ))}
            </div>
          </>
        )}
      </div>
    </SlidePanel>
  )
}
