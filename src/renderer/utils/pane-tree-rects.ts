import type { PaneTree } from '@shared/types'

export interface LeafRect {
  /** percentages of the parent box */
  x: number
  y: number
  w: number
  h: number
}

/**
 * Compute the rectangle (in percentages of the project pane) occupied by each
 * terminal leaf. Used to position TerminalPanes absolutely so they live at a
 * stable React parent and survive tree restructuring (split / collapse).
 */
export function computeTerminalRects(
  tree: PaneTree | null
): Map<string, LeafRect> {
  const rects = new Map<string, LeafRect>()
  if (!tree) return rects

  const walk = (node: PaneTree, x: number, y: number, w: number, h: number): void => {
    if (node.kind === 'leaf') {
      rects.set(node.terminalId, { x, y, w, h })
      return
    }
    const r = node.ratio
    if (node.orientation === 'row') {
      walk(node.children[0], x, y, w * r, h)
      walk(node.children[1], x + w * r, y, w * (1 - r), h)
    } else {
      walk(node.children[0], x, y, w, h * r)
      walk(node.children[1], x, y + h * r, w, h * (1 - r))
    }
  }
  walk(tree, 0, 0, 100, 100)
  return rects
}
