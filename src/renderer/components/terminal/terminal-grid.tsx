import { Fragment, memo } from 'react'
import { Group, Panel, Separator } from 'react-resizable-panels'
import { TerminalPane } from './terminal-pane'
import type { Terminal } from '@shared/types'

interface TerminalGridProps {
  terminals: Terminal[]
  activeTerminalId: string | null
  onTerminalClick: (id: string) => void
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

export const TerminalGrid = memo(function TerminalGrid({ terminals, activeTerminalId, onTerminalClick }: TerminalGridProps) {
  if (terminals.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-[var(--mc-text-muted)]">
        <div className="text-center">
          <p className="mb-2">No terminals open</p>
          <p className="text-sm">Click the + button to create one</p>
        </div>
      </div>
    )
  }

  const { cols } = calculateGrid(terminals.length)
  const rows = splitIntoRows(terminals, cols)

  return (
    <Group orientation="vertical" className="h-full">
      {rows.map((rowTerminals, rowIndex) => (
        <Fragment key={`row-${rowIndex}`}>
          <Panel defaultSize={100 / rows.length}>
            <Group orientation="horizontal" className="h-full">
              {rowTerminals.map((terminal, colIndex) => (
                <Fragment key={terminal.id}>
                  <Panel defaultSize={100 / rowTerminals.length}>
                    <TerminalPane
                      terminalId={terminal.id}
                      isActive={terminal.id === activeTerminalId}
                      onActivate={() => onTerminalClick(terminal.id)}
                    />
                  </Panel>
                  {/* Resize handle between columns (not after last) */}
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
      ))}
    </Group>
  )
})
