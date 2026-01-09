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
  // Empty state with add button
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
