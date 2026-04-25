import { memo, useCallback, useEffect, useRef, useState } from 'react'
import { useAppStore } from '../../stores'
import { useContextSnapshot } from '../../hooks/use-context-snapshot'
import type { AgentType, Terminal, TerminalTaskStatus } from '@shared/types'

const AGENT_LABEL: Record<Exclude<AgentType, 'generic'> | 'generic' | 'none', string> = {
  claude: 'Claude',
  codex: 'Codex',
  gemini: 'Gemini',
  aider: 'Aider',
  generic: 'Generic',
  none: '—'
}

function formatPct(total: number, cap = 200_000): string {
  if (total <= 0) return ''
  return `${Math.min(100, Math.round((total / cap) * 100))}%`
}

interface RowProps {
  terminal: Terminal
  isActive: boolean
  isFocused: boolean
  onActivate: (id: string) => void
}

function PaneRowImpl({ terminal, isActive, isFocused, onActivate }: RowProps) {
  const { snapshot } = useContextSnapshot(terminal.claudeSessionId ?? null)
  const total = snapshot?.total ?? 0
  const pct = formatPct(total)
  const agent = terminal.agentType ?? 'none'
  const status: TerminalTaskStatus = terminal.taskStatus ?? 'idle'
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (isFocused) ref.current?.focus({ preventScroll: true })
  }, [isFocused])

  return (
    <div
      ref={ref}
      role="option"
      aria-selected={isActive}
      tabIndex={isFocused ? 0 : -1}
      className={`pane-switcher-row${isActive ? ' is-active' : ''}`}
      data-testid={`pane-row-${terminal.id}`}
      onClick={() => onActivate(terminal.id)}
    >
      <span
        className={`pane-switcher-badge agent-${agent}`}
        data-testid={`pane-badge-${terminal.id}`}
      >
        {AGENT_LABEL[agent as keyof typeof AGENT_LABEL] ?? agent}
      </span>
      <span className="pane-switcher-title" title={terminal.title}>
        {terminal.title}
      </span>
      <span className="pane-switcher-pct" aria-label={pct ? `Context ${pct}` : 'No context yet'}>
        {pct}
      </span>
      <span
        className="pane-switcher-status"
        data-testid={`pane-status-${terminal.id}`}
        data-status={status}
        aria-label={`Status: ${status}`}
      />
    </div>
  )
}
const PaneRow = memo(PaneRowImpl)

export function PaneSwitcherHeader() {
  const terminals = useAppStore((s) => s.terminals)
  const activeTerminalId = useAppStore((s) => s.activeTerminalId)
  const setActiveTerminal = useAppStore((s) => s.setActiveTerminal)

  const [focusIndex, setFocusIndex] = useState<number>(() => {
    const idx = terminals.findIndex((t) => t.id === activeTerminalId)
    return idx >= 0 ? idx : 0
  })
  const focusIndexRef = useRef(focusIndex)
  focusIndexRef.current = focusIndex

  const onKeyDown = useCallback((e: React.KeyboardEvent<HTMLDivElement>) => {
    if (terminals.length === 0) return
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setFocusIndex((i) => {
        const next = Math.min(terminals.length - 1, i + 1)
        focusIndexRef.current = next
        return next
      })
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setFocusIndex((i) => {
        const next = Math.max(0, i - 1)
        focusIndexRef.current = next
        return next
      })
    } else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      const target = terminals[focusIndexRef.current]
      if (target) setActiveTerminal(target.id)
    }
  }, [terminals, setActiveTerminal])

  if (terminals.length === 0) return null

  return (
    <div
      role="listbox"
      aria-label="Active panes"
      className="pane-switcher-header"
      data-testid="pane-switcher-header"
      tabIndex={0}
      onKeyDown={onKeyDown}
    >
      {terminals.map((t, i) => (
        <PaneRow
          key={t.id}
          terminal={t}
          isActive={t.id === activeTerminalId}
          isFocused={i === focusIndex}
          onActivate={setActiveTerminal}
        />
      ))}
    </div>
  )
}
