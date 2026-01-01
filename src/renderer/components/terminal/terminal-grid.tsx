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
  onTerminalClick: (id: string) => void
  onAddTerminal?: () => void
  onCloseTerminal?: (id: string) => void
  onStartClaude?: (id: string) => void
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
  onTerminalClick,
  onAddTerminal,
  onCloseTerminal,
  onStartClaude
}: TerminalGridProps) {
  // Show add button if less than 9 terminals
  const showAddCell = terminals.length < 9 && onAddTerminal

  if (terminals.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-[var(--mc-text-muted)]">
        <div className="text-center">
          <p className="mb-2">No terminals open</p>
          {onAddTerminal && (
            <button
              type="button"
              onClick={onAddTerminal}
              className="px-4 py-2 bg-[var(--mc-accent)] text-[var(--mc-bg-primary)] rounded hover:opacity-90"
            >
              + New Terminal
            </button>
          )}
        </div>
      </div>
    )
  }

  // Include add cell in grid calculation
  const itemCount = showAddCell ? terminals.length + 1 : terminals.length
  const { cols } = calculateGrid(itemCount)
  const rows = splitIntoRows(terminals, cols)

  // Calculate if add cell should be in current row or new row
  const lastRowIndex = rows.length - 1
  const lastRowHasSpace = rows[lastRowIndex]?.length < cols

  return (
    <Group orientation="vertical" className="h-full">
      {rows.map((rowTerminals, rowIndex) => {
        const isLastRow = rowIndex === lastRowIndex
        const showAddInThisRow = isLastRow && showAddCell && lastRowHasSpace
        const cellCount = showAddInThisRow ? rowTerminals.length + 1 : rowTerminals.length

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
                        onActivate={() => onTerminalClick(terminal.id)}
                        onClose={() => onCloseTerminal?.(terminal.id)}
                        onStartClaude={() => onStartClaude?.(terminal.id)}
                      />
                    </Panel>
                    {/* Resize handle between columns */}
                    {colIndex < rowTerminals.length - 1 && (
                      <Separator className="terminal-resize-handle terminal-resize-handle-horizontal" />
                    )}
                  </Fragment>
                ))}

                {/* Add terminal cell */}
                {showAddInThisRow && (
                  <>
                    {rowTerminals.length > 0 && (
                      <Separator className="terminal-resize-handle terminal-resize-handle-horizontal" />
                    )}
                    <Panel defaultSize={100 / cellCount}>
                      <div
                        className="h-full flex items-center justify-center bg-[var(--mc-bg-secondary)] border border-dashed border-[var(--mc-border)] rounded cursor-pointer hover:border-[var(--mc-accent)] hover:bg-[var(--mc-bg-hover)] transition-colors"
                        onClick={onAddTerminal}
                      >
                        <div className="text-center text-[var(--mc-text-muted)]">
                          <svg className="w-8 h-8 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4v16m8-8H4" />
                          </svg>
                          <span className="text-sm">Add Terminal</span>
                        </div>
                      </div>
                    </Panel>
                  </>
                )}
              </Group>
            </Panel>
            {/* Resize handle between rows (not after last) */}
            {rowIndex < rows.length - 1 && (
              <Separator className="terminal-resize-handle terminal-resize-handle-vertical" />
            )}
          </Fragment>
        )
      })}

      {/* Add cell as new row if last row is full */}
      {showAddCell && !lastRowHasSpace && (
        <>
          <Separator className="terminal-resize-handle terminal-resize-handle-vertical" />
          <Panel defaultSize={100 / (rows.length + 1)}>
            <div
              className="h-full flex items-center justify-center bg-[var(--mc-bg-secondary)] border border-dashed border-[var(--mc-border)] rounded cursor-pointer hover:border-[var(--mc-accent)] hover:bg-[var(--mc-bg-hover)] transition-colors"
              onClick={onAddTerminal}
            >
              <div className="text-center text-[var(--mc-text-muted)]">
                <svg className="w-8 h-8 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4v16m8-8H4" />
                </svg>
                <span className="text-sm">Add Terminal</span>
              </div>
            </div>
          </Panel>
        </>
      )}
    </Group>
  )
})
