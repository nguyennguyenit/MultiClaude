import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { PaneTreeNode } from './pane-tree-node'
import { TerminalPane } from './terminal-pane'
import { usePaneTreeStore } from '../../stores/pane-tree-store'
import { reconcilePaneTree } from '../../utils/pane-tree-reconcile'
import { computeTerminalRects } from '../../utils/pane-tree-rects'
import { updateRatio } from '@shared/utils/pane-tree'
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

const DEFAULT_PROJECT_ID = 'default'
const ROOT_PATH: number[] = []

function getProjectId(terminal: Pick<Terminal, 'projectId'>): string {
  return terminal.projectId || DEFAULT_PROJECT_ID
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
  const [isPortrait, setIsPortrait] = useState(
    () => typeof window !== 'undefined' && window.innerHeight > window.innerWidth
  )

  useEffect(() => {
    const handleResize = (): void => setIsPortrait(window.innerHeight > window.innerWidth)
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  /**
   * Groups terminals by project for stable rendering (single-parent pattern).
   * All project grids render simultaneously with inactive projects hidden via CSS
   * so switching projects preserves cursor, buffer, and WebGL state in xterm.
   */
  const projectGroups = useMemo(() => {
    const groups = new Map<string, Terminal[]>()
    if (activeProjectId) groups.set(activeProjectId, [])
    for (const t of terminals) {
      const pid = getProjectId(t)
      if (!groups.has(pid)) groups.set(pid, [])
      groups.get(pid)!.push(t)
    }
    return Array.from(groups.entries()).map(([projectId, terms]) => ({
      projectId,
      isActive: projectId === activeProjectId,
      terminals: terms
    }))
  }, [terminals, activeProjectId])

  const activeGroup = projectGroups.find((g) => g.isActive)
  const visibleTerminalCount = activeGroup?.terminals.length ?? 0

  return (
    <div style={{ height: '100%', position: 'relative' }}>
      {projectGroups.map((group) => (
        <ProjectPaneView
          key={group.projectId}
          projectId={group.projectId}
          isActive={group.isActive}
          terminals={group.terminals}
          activeTerminalId={activeTerminalId}
          isPortrait={isPortrait}
          onTerminalClick={onTerminalClick}
          onCloseTerminal={onCloseTerminal}
          onInsertFilePath={onInsertFilePath}
          onTitleChange={onTitleChange}
        />
      ))}

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

interface ProjectPaneViewProps {
  projectId: string
  isActive: boolean
  terminals: Terminal[]
  activeTerminalId: string | null
  isPortrait: boolean
  onTerminalClick: (id: string) => void
  onCloseTerminal?: (id: string) => void
  onInsertFilePath?: (terminalId: string, paths: string[]) => void
  onTitleChange?: (terminalId: string, title: string) => void
}

function ProjectPaneView({
  projectId,
  isActive,
  terminals,
  activeTerminalId,
  isPortrait,
  onTerminalClick,
  onCloseTerminal,
  onInsertFilePath,
  onTitleChange
}: ProjectPaneViewProps) {
  const loadTreeForProject = usePaneTreeStore((s) => s.loadTreeForProject)
  const setTree = usePaneTreeStore((s) => s.setTree)
  const rawTree = usePaneTreeStore((s) => s.treesByProject[projectId])
  const treeLoaded = rawTree !== undefined

  useEffect(() => {
    if (!treeLoaded) void loadTreeForProject(projectId)
  }, [projectId, treeLoaded, loadTreeForProject])

  const terminalIds = useMemo(() => terminals.map((t) => t.id), [terminals])

  const reconciled = useMemo(
    () => reconcilePaneTree(rawTree ?? null, terminalIds, isPortrait),
    [rawTree, terminalIds, isPortrait]
  )

  // Persist any reshape caused by reconciliation (add/remove) so the tree on
  // disk stays canonical.
  useEffect(() => {
    if (!treeLoaded) return
    const current = rawTree ?? null
    if (current !== reconciled && JSON.stringify(current) !== JSON.stringify(reconciled)) {
      setTree(projectId, reconciled)
    }
  }, [projectId, reconciled, rawTree, treeLoaded, setTree])

  // Hold latest tree in a ref so handleSetRatio identity stays stable across
  // renders — otherwise PaneTreeNode's memo() bails on every parent re-render.
  const treeRef = useRef(reconciled)
  treeRef.current = reconciled

  const handleSetRatio = useCallback(
    (path: number[], ratio: number): void => {
      const current = treeRef.current
      if (!current) return
      setTree(projectId, updateRatio(current, path, ratio))
    },
    [projectId, setTree]
  )

  // Rect (in % of project pane) for each terminal, walked from the tree.
  // Used to position TerminalPanes absolutely so they share a stable React
  // parent and never unmount when the surrounding tree restructures.
  const rects = useMemo(() => computeTerminalRects(reconciled), [reconciled])

  return (
    <div
      className="project-terminal-grid"
      role="region"
      aria-label={`Terminal grid for project ${projectId}`}
      aria-hidden={!isActive}
      style={{
        visibility: isActive ? 'visible' : 'hidden',
        position: isActive ? 'relative' : 'absolute',
        pointerEvents: isActive ? 'auto' : 'none',
        width: '100%',
        height: '100%',
        top: 0,
        left: 0
      }}
    >
      {/* Layout skeleton: flex containers + resize handles only. Empty leaves. */}
      {reconciled ? (
        <div style={{ position: 'absolute', inset: 0, display: 'flex' }}>
          <PaneTreeNode
            node={reconciled}
            path={ROOT_PATH}
            activeTerminalId={activeTerminalId}
            onSetRatio={handleSetRatio}
          />
        </div>
      ) : null}

      {/* Terminal panes — stable React parent; positioned over the slot rects. */}
      {terminals.map((t) => {
        const r = rects.get(t.id)
        if (!r) return null
        return (
          <div
            key={t.id}
            className={`terminal-cell-overlay${t.id === activeTerminalId ? ' active' : ''}`}
            style={{
              position: 'absolute',
              left: `${r.x}%`,
              top: `${r.y}%`,
              width: `${r.w}%`,
              height: `${r.h}%`,
              display: 'flex',
              minWidth: 0,
              minHeight: 0,
              pointerEvents: 'auto',
              zIndex: t.id === activeTerminalId ? 1 : 0
            }}
          >
            <TerminalPane
              terminalId={t.id}
              title={t.title ?? t.id}
              isActive={t.id === activeTerminalId}
              hidden={!isActive}
              isClaudeMode={t.isClaudeMode ?? false}
              agentType={t.agentType}
              onActivate={() => onTerminalClick(t.id)}
              onClose={() => onCloseTerminal?.(t.id)}
              onInsertFilePath={(paths) => onInsertFilePath?.(t.id, paths)}
              onTitleChange={(title) => onTitleChange?.(t.id, title)}
            />
          </div>
        )
      })}
    </div>
  )
}
