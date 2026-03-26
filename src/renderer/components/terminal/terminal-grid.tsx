import { memo, useEffect, useMemo, useRef, useState } from 'react'
import { TerminalPane } from './terminal-pane'
import { ResizeHandle } from './terminal-resize-handle'
import { useTerminalResize } from '../../hooks/use-terminal-resize'
import type { Terminal } from '@shared/types'

interface TerminalGridProps {
  terminals: Terminal[]
  activeProjectId: string | null
  activeProjectPath?: string
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

/** Calculate grid dimensions based on terminal count and screen orientation */
function calculateGrid(count: number, isPortrait: boolean): { rows: number; cols: number } {
  if (count <= 1) return { rows: 1, cols: 1 }
  if (count <= 2) {
    // Portrait: stack vertically | Landscape: side-by-side
    return isPortrait ? { rows: 2, cols: 1 } : { rows: 1, cols: 2 }
  }
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
  activeProjectPath,
  activeTerminalId,
  onTerminalClick,
  onAddTerminal,
  onCloseTerminal,
  onInsertFilePath,
  onTitleChange
}: TerminalGridProps) {
  // Detect portrait orientation for responsive grid layout
  const [isPortrait, setIsPortrait] = useState(
    () => typeof window !== 'undefined' && window.innerHeight > window.innerWidth
  )

  useEffect(() => {
    const handleResize = () => setIsPortrait(window.innerHeight > window.innerWidth)
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  /**
   * Groups terminals by project for stable rendering (single-parent pattern).
   * All project grids are rendered simultaneously with inactive projects hidden via CSS.
   * This prevents React from unmounting terminals when switching projects,
   * preserving cursor position, buffer content, and WebGL state.
  */
  const projectGroups = useMemo(() => {
    const groups = new Map<string, Terminal[]>()
    if (activeProjectId) groups.set(activeProjectId, [])
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

  // Get active project's terminals for grid layout calculation
  const activeGroup = projectGroups.find(g => g.isActive)
  const visibleTerminalCount = activeGroup?.terminals.length ?? 0

  // Compute resize grid shape based on active project
  const activeGrid = activeGroup
    ? calculateGrid(activeGroup.terminals.length, isPortrait)
    : { rows: 1, cols: 1 }

  const activeRows = activeGroup ? splitIntoRows(activeGroup.terminals, activeGrid.cols) : []
  const numColsPerRow = activeRows.map(row => row.length)

  // Resize state: flex values for rows and per-row columns
  const gridContainerRef = useRef<HTMLDivElement>(null)
  const { getRowFlex, getColFlex, startRowResize, startColResize } = useTerminalResize(
    activeProjectId,
    activeRows.length,
    numColsPerRow,
    gridContainerRef
  )

  return (
    <div style={{ height: '100%', position: 'relative' }}>
      {/* All project grids rendered in single parent - inactive hidden with visibility:hidden.
          visibility:hidden preserves xterm.js scroll/cursor state unlike display:none */}
      {projectGroups.map(group => {
        const { cols } = calculateGrid(group.terminals.length, isPortrait)
        const rows = splitIntoRows(group.terminals, cols)

        return (
          <div
            key={group.projectId}
            ref={group.isActive ? gridContainerRef : undefined}
            role="region"
            aria-label={`Terminal grid for project ${group.projectId}`}
            aria-hidden={!group.isActive}
            style={{
              visibility: group.isActive ? 'visible' : 'hidden',
              position: group.isActive ? 'relative' : 'absolute',
              pointerEvents: group.isActive ? 'auto' : 'none',
              width: '100%',
              height: '100%',
              top: 0,
              left: 0
            }}
          >
            <div className="terminal-grid">
              {rows.map((rowTerminals, rowIndex) => (
                <div key={`row-${rowIndex}`} style={{ display: 'contents' }}>
                  {/* Horizontal resize handle between rows */}
                  {rowIndex > 0 && group.isActive && (
                    <ResizeHandle
                      direction="horizontal"
                      onResizeStart={(y) => startRowResize(rowIndex - 1, y)}
                    />
                  )}

                  <div
                    className="terminal-row"
                    style={{ flex: group.isActive ? getRowFlex(rowIndex) : 1 }}
                  >
                    {rowTerminals.map((terminal, colIndex) => (
                      <div key={terminal.id} style={{ display: 'contents' }}>
                        {/* Vertical resize handle between columns */}
                        {colIndex > 0 && group.isActive && (
                          <ResizeHandle
                            direction="vertical"
                            onResizeStart={(x) => startColResize(rowIndex, colIndex - 1, x)}
                          />
                        )}

                        <div
                          className={`terminal-cell${terminal.id === activeTerminalId ? ' active' : ''}`}
                          style={{ flex: group.isActive ? getColFlex(rowIndex, colIndex) : 1 }}
                        >
                          <TerminalPane
                            terminalId={terminal.id}
                            title={terminal.title}
                            isActive={terminal.id === activeTerminalId}
                            hidden={!group.isActive || terminal.id !== activeTerminalId}
                            isClaudeMode={terminal.isClaudeMode}
                            onActivate={() => onTerminalClick(terminal.id)}
                            onClose={() => onCloseTerminal?.(terminal.id)}
                            onInsertFilePath={(paths) => onInsertFilePath?.(terminal.id, paths)}
                            onTitleChange={(title) => onTitleChange?.(terminal.id, title)}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )
      })}

      {visibleTerminalCount === 0 && (
        <div className="welcome-screen" style={{ position: 'absolute', inset: 0 }}>
          <svg className="welcome-terminal-icon" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="4 17 10 11 4 5" />
            <line x1="12" y1="19" x2="20" y2="19" />
          </svg>
          <h2 className="welcome-title" style={{ fontSize: '24px' }}>Multi Terminals</h2>
          <p className="welcome-hint" style={{ margin: 0 }}>
            Spawn multiple terminals to run agents in parallel.
            <br />
            Press <kbd>Ctrl+T</kbd> to create a new terminal.
          </p>
          {onAddTerminal && (
            <button type="button" onClick={() => onAddTerminal()} className="welcome-btn">
              + New Terminal
            </button>
          )}
          {activeProjectPath && (
            <p className="welcome-project-path" title={activeProjectPath}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z" />
              </svg>
              {activeProjectPath}
            </p>
          )}
        </div>
      )}
    </div>
  )
})
