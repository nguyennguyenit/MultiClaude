/**
 * PaneTree — binary split-tree layout model for terminals.
 *
 * Mirrors tmux/iTerm/VSCode editor groups: every split has exactly two
 * children, each owning a fraction of the parent axis (`ratio`).
 *
 * - `orientation: 'row'`    → children laid out side-by-side (horizontal split)
 * - `orientation: 'column'` → children stacked vertically   (vertical split)
 *
 * Pure data — no React, DOM, or IPC. Operated on by `utils/pane-tree.ts`.
 */

export type PaneSplitDirection = 'right' | 'left' | 'down' | 'up'
export type SplitOrientation = 'row' | 'column'

export interface PaneLeaf {
  kind: 'leaf'
  terminalId: string
}

export interface PaneSplit {
  kind: 'split'
  orientation: SplitOrientation
  ratio: number
  children: [PaneTree, PaneTree]
}

export type PaneTree = PaneLeaf | PaneSplit

export const PANE_RATIO_MIN = 0.1
export const PANE_RATIO_MAX = 0.9
