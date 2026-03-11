# Phase 3: Terminal Cell with Header

## Objective
Add header bar to each terminal pane with title, Claude button, and close button.

## Files to Modify

### 1. `src/renderer/components/terminal/terminal-pane.tsx`

Replace entire file:

```typescript
import { useEffect, useRef, useCallback, memo, useState } from 'react'
import { TerminalView } from './terminal-view'

interface TerminalPaneProps {
  terminalId: string
  title: string
  isActive: boolean
  isClaudeMode: boolean
  onActivate: () => void
  onClose: () => void
  onStartClaude: () => void
  onTitleChange?: (title: string) => void
}

export const TerminalPane = memo(function TerminalPane({
  terminalId,
  title,
  isActive,
  isClaudeMode,
  onActivate,
  onClose,
  onStartClaude,
  onTitleChange
}: TerminalPaneProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const resizeTimeoutRef = useRef<number | undefined>(undefined)
  const terminalFitRef = useRef<(() => void) | null>(null)
  const [isEditing, setIsEditing] = useState(false)
  const [editTitle, setEditTitle] = useState(title)

  const handleTerminalFit = useCallback((fitFn: () => void) => {
    terminalFitRef.current = fitFn
  }, [])

  // Debounced fit on container resize
  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const resizeObserver = new ResizeObserver(() => {
      if (resizeTimeoutRef.current) {
        clearTimeout(resizeTimeoutRef.current)
      }
      resizeTimeoutRef.current = window.setTimeout(() => {
        terminalFitRef.current?.()
      }, 100)
    })

    resizeObserver.observe(container)

    return () => {
      resizeObserver.disconnect()
      if (resizeTimeoutRef.current) {
        clearTimeout(resizeTimeoutRef.current)
      }
    }
  }, [])

  const handleTitleDoubleClick = () => {
    setEditTitle(title)
    setIsEditing(true)
  }

  const handleTitleSave = () => {
    setIsEditing(false)
    if (editTitle.trim() && editTitle !== title) {
      onTitleChange?.(editTitle.trim())
    }
  }

  const handleTitleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleTitleSave()
    } else if (e.key === 'Escape') {
      setIsEditing(false)
      setEditTitle(title)
    }
  }

  return (
    <div
      ref={containerRef}
      onClick={onActivate}
      className={`h-full w-full flex flex-col ${isActive ? 'ring-1 ring-[var(--mc-accent)]' : ''}`}
    >
      {/* Header Bar */}
      <div className="h-7 flex items-center justify-between px-2 bg-[var(--mc-bg-tertiary)] border-b border-[var(--mc-border)]">
        {/* Title */}
        <div className="flex-1 min-w-0">
          {isEditing ? (
            <input
              type="text"
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)}
              onBlur={handleTitleSave}
              onKeyDown={handleTitleKeyDown}
              className="w-full bg-transparent text-sm px-1 outline-none"
              autoFocus
            />
          ) : (
            <span
              onDoubleClick={handleTitleDoubleClick}
              className="text-sm truncate cursor-default"
              title="Double-click to rename"
            >
              {title}
            </span>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1">
          {/* Claude Mode Indicator */}
          {isClaudeMode && (
            <span className="text-xs text-[var(--mc-accent)] px-1">Claude</span>
          )}

          {/* Start Claude Button */}
          {!isClaudeMode && (
            <button
              onClick={(e) => {
                e.stopPropagation()
                onStartClaude()
              }}
              className="p-1 hover:bg-[var(--mc-bg-hover)] rounded"
              title="Start Claude"
            >
              <svg className="w-3.5 h-3.5 text-[var(--mc-accent)]" fill="currentColor" viewBox="0 0 24 24">
                <path d="M8 5v14l11-7z" />
              </svg>
            </button>
          )}

          {/* Close Button */}
          <button
            onClick={(e) => {
              e.stopPropagation()
              onClose()
            }}
            className="p-1 hover:bg-[var(--mc-bg-hover)] rounded"
            title="Close Terminal"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>

      {/* Terminal Content */}
      <div className="flex-1 min-h-0">
        <TerminalView
          terminalId={terminalId}
          isActive={isActive}
          onFitReady={handleTerminalFit}
        />
      </div>
    </div>
  )
})
```

### 2. `src/renderer/components/terminal/terminal-grid.tsx`

Update to pass new props and add empty cell:

```typescript
import { Fragment, memo } from 'react'
import { Group, Panel, Separator } from 'react-resizable-panels'
import { TerminalPane } from './terminal-pane'
import type { Terminal } from '@shared/types'

interface TerminalGridProps {
  terminals: Terminal[]
  activeTerminalId: string | null
  onTerminalClick: (id: string) => void
  onTerminalClose: (id: string) => void
  onStartClaude: (id: string) => void
  onAddTerminal: () => void
  maxTerminals?: number
}

function calculateGrid(count: number): { rows: number; cols: number } {
  if (count <= 1) return { rows: 1, cols: 1 }
  if (count <= 2) return { rows: 1, cols: 2 }
  if (count <= 4) return { rows: 2, cols: 2 }
  if (count <= 6) return { rows: 2, cols: 3 }
  if (count <= 9) return { rows: 3, cols: 3 }
  return { rows: 3, cols: 3 }
}

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
  onTerminalClose,
  onStartClaude,
  onAddTerminal,
  maxTerminals = 9
}: TerminalGridProps) {
  // Show add button if under max
  const showAddButton = terminals.length < maxTerminals

  if (terminals.length === 0) {
    return (
      <div className="flex items-center justify-center h-full">
        <button
          onClick={onAddTerminal}
          className="flex flex-col items-center gap-2 p-6 rounded-lg hover:bg-[var(--mc-bg-hover)] transition-colors"
        >
          <svg className="w-12 h-12 text-[var(--mc-text-muted)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4v16m8-8H4" />
          </svg>
          <span className="text-[var(--mc-text-muted)]">Create Terminal</span>
          <span className="text-xs text-[var(--mc-text-muted)]">Ctrl+N</span>
        </button>
      </div>
    )
  }

  // Add placeholder for add button
  const items = [...terminals]
  if (showAddButton) {
    items.push({ id: '__add__' } as Terminal)
  }

  const { cols } = calculateGrid(items.length)
  const rows = splitIntoRows(items, cols)

  return (
    <Group orientation="vertical" className="h-full">
      {rows.map((rowTerminals, rowIndex) => (
        <Fragment key={`row-${rowIndex}`}>
          <Panel defaultSize={100 / rows.length}>
            <Group orientation="horizontal" className="h-full">
              {rowTerminals.map((terminal, colIndex) => (
                <Fragment key={terminal.id}>
                  <Panel defaultSize={100 / rowTerminals.length}>
                    {terminal.id === '__add__' ? (
                      <button
                        onClick={onAddTerminal}
                        className="w-full h-full flex items-center justify-center hover:bg-[var(--mc-bg-hover)] transition-colors"
                      >
                        <div className="flex flex-col items-center gap-1 text-[var(--mc-text-muted)]">
                          <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4v16m8-8H4" />
                          </svg>
                          <span className="text-xs">Add Terminal</span>
                        </div>
                      </button>
                    ) : (
                      <TerminalPane
                        terminalId={terminal.id}
                        title={terminal.title}
                        isActive={terminal.id === activeTerminalId}
                        isClaudeMode={terminal.isClaudeMode}
                        onActivate={() => onTerminalClick(terminal.id)}
                        onClose={() => onTerminalClose(terminal.id)}
                        onStartClaude={() => onStartClaude(terminal.id)}
                      />
                    )}
                  </Panel>
                  {colIndex < rowTerminals.length - 1 && (
                    <Separator className="terminal-resize-handle terminal-resize-handle-horizontal" />
                  )}
                </Fragment>
              ))}
            </Group>
          </Panel>
          {rowIndex < rows.length - 1 && (
            <Separator className="terminal-resize-handle terminal-resize-handle-vertical" />
          )}
        </Fragment>
      ))}
    </Group>
  )
})
```

## Visual Reference

```
┌─────────────────────────────────────┐
│ Terminal 1              [⚡] [✕]   │ ← 28px header
├─────────────────────────────────────┤
│                                     │
│  $ claude                           │
│  > How can I help?                  │
│                                     │
└─────────────────────────────────────┘
```

## Validation

After implementation:
1. Header bar displays on each terminal
2. Title shows correctly
3. Double-click title enables editing
4. Claude button starts Claude
5. Close button closes terminal
6. Add button shows when < 9 terminals
