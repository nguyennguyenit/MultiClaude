import { memo, useCallback, useRef, type ReactElement } from 'react'
import { TerminalPane } from './terminal-pane'
import { ResizeHandle } from './terminal-resize-handle'
import { usePaneResize } from '../../hooks/use-pane-resize'
import type { PaneSplit, PaneTree, Terminal } from '@shared/types'

export interface PaneTreeNodeProps {
  node: PaneTree
  path: number[]
  activeTerminalId: string | null
  hidden?: boolean
  terminalsById?: Record<string, Terminal>
  onTerminalClick: (id: string) => void
  onCloseTerminal: (id: string) => void
  onInsertFilePath?: (terminalId: string, paths: string[]) => void
  onTitleChange?: (terminalId: string, title: string) => void
  onSetRatio: (path: number[], ratio: number) => void
}

export const PaneTreeNode = memo(function PaneTreeNode(props: PaneTreeNodeProps): ReactElement {
  const { node } = props
  if (node.kind === 'leaf') {
    const terminal = props.terminalsById?.[node.terminalId]
    return (
      <div
        key={`leaf-${node.terminalId}`}
        className={`terminal-cell${node.terminalId === props.activeTerminalId ? ' active' : ''}`}
        style={{ width: '100%', height: '100%', display: 'flex' }}
      >
        <TerminalPane
          terminalId={node.terminalId}
          title={terminal?.title ?? node.terminalId}
          isActive={node.terminalId === props.activeTerminalId}
          hidden={props.hidden}
          isClaudeMode={terminal?.isClaudeMode ?? false}
          agentType={terminal?.agentType}
          onActivate={() => props.onTerminalClick(node.terminalId)}
          onClose={() => props.onCloseTerminal(node.terminalId)}
          onInsertFilePath={(paths) => props.onInsertFilePath?.(node.terminalId, paths)}
          onTitleChange={(title) => props.onTitleChange?.(node.terminalId, title)}
        />
      </div>
    )
  }
  return <SplitView split={node} {...props} />
})

interface SplitViewProps extends PaneTreeNodeProps {
  split: PaneSplit
}

function SplitView({ split, path, onSetRatio, ...rest }: SplitViewProps): ReactElement {
  const containerRef = useRef<HTMLDivElement>(null)
  const handleRatio = useCallback(
    (r: number) => onSetRatio(path, r),
    [onSetRatio, path]
  )
  const { beginDrag } = usePaneResize({
    orientation: split.orientation,
    startRatio: split.ratio,
    containerRef,
    onRatioChange: handleRatio
  })

  const isRow = split.orientation === 'row'

  return (
    <div
      ref={containerRef}
      className="pane-tree-split"
      style={{
        display: 'flex',
        flexDirection: isRow ? 'row' : 'column',
        width: '100%',
        height: '100%',
        minWidth: 0,
        minHeight: 0
      }}
    >
      <div
        data-pane-child="0"
        style={{
          flexGrow: split.ratio,
          flexShrink: 1,
          flexBasis: 0,
          minWidth: 0,
          minHeight: 0,
          display: 'flex'
        }}
      >
        <PaneTreeNode
          {...rest}
          node={split.children[0]}
          path={[...path, 0]}
          onSetRatio={onSetRatio}
        />
      </div>

      <ResizeHandle
        direction={isRow ? 'vertical' : 'horizontal'}
        onResizeStart={beginDrag}
      />

      <div
        data-pane-child="1"
        style={{
          flexGrow: 1 - split.ratio,
          flexShrink: 1,
          flexBasis: 0,
          minWidth: 0,
          minHeight: 0,
          display: 'flex'
        }}
      >
        <PaneTreeNode
          {...rest}
          node={split.children[1]}
          path={[...path, 1]}
          onSetRatio={onSetRatio}
        />
      </div>
    </div>
  )
}
