import { Fragment, memo, useMemo } from 'react'
import { Group, Panel, Separator } from 'react-resizable-panels'
import { TerminalPane } from './terminal-pane'
import type { Terminal } from '@shared/types'

interface TerminalWithOutput extends Terminal {
  output: string
}

interface TerminalGridProps {
  terminals: TerminalWithOutput[]
  activeProjectId: string | null
  activeTerminalId: string | null
  onTerminalClick: (id: string) => void
  onAddTerminal?: () => void
  onCloseTerminal?: (id: string) => void
  onInsertFilePath?: (terminalId: string, paths: string[]) => void
  onTitleChange?: (terminalId: string, title: string) => void
}

/** Default project ID for terminals without explicit projectId */
const DEFAULT_PROJECT_ID = 'default'

/** Get project ID from terminal, using default fallback */
function getProjectId(terminal: Pick<Terminal, 'projectId'>): string {
  return terminal.projectId || DEFAULT_PROJECT_ID
}

/** Calculate grid dimensions based on terminal count */
function calculateGrid(count: number): { rows: number; cols: number } {
  if (count <= 1) return { rows: 1, cols: 1 }
  if (count <= 2) return { rows: 1, cols: 2 }
  if (count <= 4) return { rows: 2, cols: 2 }
  if (count <= 6) return { rows: 2, cols: 3 }
  if (count <= 9) return { rows: 3, cols: 3 }
  return { rows: 3, cols: 4 } // max 12
}

/** Split terminals into rows based on grid config */
function splitIntoRows<T>(items: T[], cols: number): T[][] {
  const rows: T[][] = []
  for (let i = 0; i < items.length; i += cols) {
    rows.push(items.slice(i, i + cols))
  }
  return rows
}

export const TerminalGrid = memo(function TerminalGrid({
  terminals,
  activeProjectId,
  activeTerminalId,
  onTerminalClick,
  onAddTerminal,
  onCloseTerminal,
  onInsertFilePath,
  onTitleChange
}: TerminalGridProps) {
  /**
   * Groups terminals by project for stable rendering (single-parent pattern).
   * All project grids are rendered simultaneously in a single parent hierarchy,
   * with inactive projects hidden via CSS `display: none`.
   *
   * This prevents React reconciliation from unmounting terminals when switching
   * projects, preserving cursor position, buffer content, and WebGL state.
   *
   * Note: Memory impact is proportional to total terminals across all projects.
   * Consider implementing cleanup for long-inactive projects if memory becomes a concern.
   */
  const projectGroups = useMemo(() => {
    const groups = new Map<string, TerminalWithOutput[]>()
    for (const t of terminals) {
      const pid = getProjectId(t)
      if (!groups.has(pid)) groups.set(pid, [])
      const group = groups.get(pid)
      if (group) group.push(t)
    }
    return Array.from(groups.entries()).map(([projectId, terms]) => ({
      projectId,
      isActive: projectId === activeProjectId,
      terminals: terms
    }))
  }, [terminals, activeProjectId])

  // Get active project's terminals for empty state check
  const activeGroup = projectGroups.find(g => g.isActive)
  const visibleTerminalCount = activeGroup?.terminals.length ?? 0

  // Empty state - Agent Terminals welcome screen (based on visible terminals)
  if (visibleTerminalCount === 0) {
    return (
      <div className="flex items-center justify-center h-full bg-[var(--mc-bg-primary)] relative overflow-hidden">
        {/* Background Glow */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-[var(--mc-accent)]/5 rounded-full blur-3xl pointer-events-none" />

        <div className="text-center relative z-10 p-8">
          {/* Grid Icon */}
          <div className="w-20 h-20 mx-auto mb-8 rounded-2xl bg-gradient-to-br from-[var(--mc-bg-tertiary)] to-[var(--mc-bg-secondary)] border border-[var(--mc-border)] flex items-center justify-center shadow-lg group">
            <svg className="w-10 h-10 text-[var(--mc-accent)] transition-transform duration-500 group-hover:scale-110" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <rect x="3" y="3" width="7" height="7" rx="1.5" />
              <rect x="14" y="3" width="7" height="7" rx="1.5" />
              <rect x="3" y="14" width="7" height="7" rx="1.5" />
              <rect x="14" y="14" width="7" height="7" rx="1.5" />
            </svg>
          </div>

          {/* Title */}
          <h2 className="text-3xl font-bold mb-4 bg-gradient-to-r from-[var(--mc-text-primary)] to-[var(--mc-text-secondary)] bg-clip-text text-transparent">
            Multi Terminals
          </h2>

          {/* Description */}
          <p className="text-[var(--mc-text-secondary)] mb-8 max-w-md mx-auto text-base leading-relaxed">
            Spawn multiple terminals to run agents in parallel.
            <br />
            Use{' '}
            <kbd className="px-2 py-0.5 bg-[var(--mc-bg-tertiary)] border border-[var(--mc-border)] rounded-md text-sm font-mono text-[var(--mc-text-primary)] shadow-sm">
              Ctrl+T
            </kbd>{' '}
            to create a new terminal.
          </p>

          {/* New Terminal Button */}
          {onAddTerminal && (
            <button
              type="button"
              onClick={() => onAddTerminal()}
              className="inline-flex items-center gap-2 px-6 py-3 bg-[var(--mc-accent)] text-[var(--mc-bg-primary)] font-semibold rounded-xl hover:opacity-90 transition-all hover:scale-105 active:scale-95 shadow-lg shadow-[var(--mc-accent)]/20"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
              </svg>
              New Terminal
            </button>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="h-full">
      {/* All project grids rendered in single parent - inactive hidden with CSS */}
      {/* This prevents React reconciliation from unmounting terminals on project switch */}
      {projectGroups.map(group => {
        const { cols } = calculateGrid(group.terminals.length)
        const rows = splitIntoRows(group.terminals, cols)

        return (
          <div
            key={group.projectId}
            role="region"
            aria-label={`Terminal grid for project ${group.projectId}`}
            style={{
              display: group.isActive ? 'flex' : 'none',
              flexDirection: 'column',
              height: '100%'
            }}
            aria-hidden={!group.isActive}
          >
            <Group orientation="vertical" className="h-full">
              {rows.map((rowTerminals, rowIndex) => {
                const cellCount = rowTerminals.length

                return (
                  <Fragment key={`row-${rowIndex}`}>
                    <Panel defaultSize={100 / rows.length}>
                      <Group orientation="horizontal" className="h-full">
                        {rowTerminals.map((terminal, colIndex) => (
                          <Fragment key={terminal.id}>
                            <Panel defaultSize={100 / cellCount}>
                              <TerminalPane
                                terminalId={terminal.id}
                                title={terminal.title}
                                isActive={terminal.id === activeTerminalId}
                                hidden={!group.isActive}
                                isClaudeMode={terminal.isClaudeMode}
                                initialOutput={terminal.output}
                                onActivate={() => onTerminalClick(terminal.id)}
                                onClose={() => onCloseTerminal?.(terminal.id)}
                                onInsertFilePath={(paths) => onInsertFilePath?.(terminal.id, paths)}
                                onTitleChange={(title) => onTitleChange?.(terminal.id, title)}
                              />
                            </Panel>
                            {/* Resize handle between columns */}
                            {colIndex < rowTerminals.length - 1 && (
                              <Separator className="terminal-resize-handle terminal-resize-handle-horizontal" />
                            )}
                          </Fragment>
                        ))}
                      </Group>
                    </Panel>
                    {/* Resize handle between rows (not after last) */}
                    {rowIndex < rows.length - 1 && (
                      <Separator className="terminal-resize-handle terminal-resize-handle-vertical" />
                    )}
                  </Fragment>
                )
              })}
            </Group>
          </div>
        )
      })}
    </div>
  )
})
