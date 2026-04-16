import { memo, useCallback, useMemo, useRef, type ReactElement } from 'react'
import { ResizeHandle } from './terminal-resize-handle'
import { usePaneResize } from '../../hooks/use-pane-resize'
import type { PaneSplit, PaneTree } from '@shared/types'

export interface PaneTreeNodeProps {
  node: PaneTree
  path: number[]
  activeTerminalId: string | null
  onSetRatio: (path: number[], ratio: number) => void
}

/**
 * PaneTreeNode renders only the LAYOUT skeleton (flex containers + resize
 * handles). Leaves are empty slot divs — the TerminalPane components live at
 * the top of ProjectPaneView and are positioned absolutely from rects derived
 * by walking the tree. This keeps each TerminalPane mounted at a stable React
 * parent so a leaf becoming a split (or vice-versa) does not unmount the
 * underlying xterm instance, which would otherwise restore from the cumulative
 * output buffer and visibly stack repeated prompts.
 */
export const PaneTreeNode = memo(function PaneTreeNode(props: PaneTreeNodeProps): ReactElement {
  const { node } = props
  if (node.kind === 'leaf') {
    return (
      <div
        key={`leaf-${node.terminalId}`}
        data-pane-leaf={node.terminalId}
        className={`terminal-cell${node.terminalId === props.activeTerminalId ? ' active' : ''}`}
        style={{ width: '100%', height: '100%' }}
      />
    )
  }
  return <SplitView split={node} {...props} />
})

interface SplitViewProps extends PaneTreeNodeProps {
  split: PaneSplit
}

function SplitView({ split, path, onSetRatio, ...rest }: SplitViewProps): ReactElement {
  const containerRef = useRef<HTMLDivElement>(null)
  // Memoize child paths so PaneTreeNode's memo() doesn't bail out on every
  // parent re-render due to fresh array identity.
  const childPath0 = useMemo(() => [...path, 0], [path])
  const childPath1 = useMemo(() => [...path, 1], [path])
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
          path={childPath0}
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
          path={childPath1}
          onSetRatio={onSetRatio}
        />
      </div>
    </div>
  )
}
