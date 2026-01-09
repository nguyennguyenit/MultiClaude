import { Fragment, memo } from 'react'
import { Group, Panel, Separator } from 'react-resizable-panels'
import { TerminalPane } from './terminal-pane'
import type { Terminal } from '@shared/types'

interface TerminalWithOutput extends Terminal {
  output: string
}

interface TerminalGridProps {
  terminals: TerminalWithOutput[]
  activeTerminalId: string | null
  isTransitioning?: boolean
  onTerminalClick: (id: string) => void
  onAddTerminal?: () => void
  onCloseTerminal?: (id: string) => void
  onInsertFilePath?: (terminalId: string, paths: string[]) => void
  onTitleChange?: (terminalId: string, title: string) => void
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
  activeTerminalId,
  isTransitioning = false,
  onTerminalClick,
  onAddTerminal,
  onCloseTerminal,
  onInsertFilePath,
  onTitleChange
}: TerminalGridProps) {
  // Empty state - Agent Terminals welcome screen
  if (terminals.length === 0) {
    return (
      <div className="flex items-center justify-center h-full bg-[var(--mc-bg-primary)]">
        <div className="text-center">
          {/* Grid Icon */}
          <div className="w-16 h-16 mx-auto mb-6 rounded-xl bg-[var(--mc-bg-tertiary)] border border-[var(--mc-border)] flex items-center justify-center">
            <svg className="w-8 h-8 text-[var(--mc-accent)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <rect x="3" y="3" width="7" height="7" rx="1" />
              <rect x="14" y="3" width="7" height="7" rx="1" />
              <rect x="3" y="14" width="7" height="7" rx="1" />
              <rect x="14" y="14" width="7" height="7" rx="1" />
            </svg>
          </div>

          {/* Title */}
          <h2 className="text-xl font-semibold text-[var(--mc-text-primary)] mb-2">
            Agent Terminals
          </h2>

          {/* Description */}
          <p className="text-[var(--mc-text-secondary)] mb-6 max-w-sm mx-auto">
            Spawn multiple terminals to run Claude agents in parallel. Use{' '}
            <kbd className="px-1.5 py-0.5 bg-[var(--mc-bg-tertiary)] border border-[var(--mc-border)] rounded text-xs font-mono">
              Ctrl+T
            </kbd>{' '}
            to create a new terminal.
          </p>

          {/* New Terminal Button */}
          {onAddTerminal && (
            <button
              type="button"
              onClick={onAddTerminal}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-[var(--mc-accent)] text-[var(--mc-bg-primary)] font-medium rounded-lg hover:opacity-90 transition-opacity"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
              </svg>
              New Terminal
            </button>
          )}
        </div>
      </div>
    )
  }

  // Calculate grid based only on actual terminals (no placeholder)
  const { cols } = calculateGrid(terminals.length)
  const rows = splitIntoRows(terminals, cols)

  return (
    <div
      className={`h-full transition-opacity duration-100 ${
        isTransitioning ? 'opacity-50 pointer-events-none' : 'opacity-100'
      }`}
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
})
