import { PANE_RATIO_MAX, PANE_RATIO_MIN, type PaneTree } from '@shared/types'

/**
 * Grid dimensions for a given terminal count. Must match the legacy
 * `calculateGrid` in terminal-grid.tsx so migrated trees render identically.
 */
function calculateGrid(count: number, isPortrait: boolean): { rows: number; cols: number } {
  if (count <= 1) return { rows: 1, cols: 1 }
  if (count <= 2) return isPortrait ? { rows: 2, cols: 1 } : { rows: 1, cols: 2 }
  if (count <= 4) return { rows: 2, cols: 2 }
  if (count <= 6) return { rows: 2, cols: 3 }
  if (count <= 9) return { rows: 3, cols: 3 }
  return { rows: 3, cols: 4 }
}

function clampRatio(r: number): number {
  if (r < PANE_RATIO_MIN) return PANE_RATIO_MIN
  if (r > PANE_RATIO_MAX) return PANE_RATIO_MAX
  return r
}

/**
 * Build a right-leaning row-split chain for `n` leaves.
 * Ratios are chosen so each leaf occupies 1/n of the axis — the leftmost
 * leaf gets 1/n, the rest split the remainder proportionally.
 */
function buildRowChain(terminalIds: string[]): PaneTree {
  const n = terminalIds.length
  if (n === 0) throw new Error('buildRowChain: empty list')
  if (n === 1) return { kind: 'leaf', terminalId: terminalIds[0] }
  const first = terminalIds[0]
  const rest = terminalIds.slice(1)
  return {
    kind: 'split',
    orientation: 'row',
    ratio: clampRatio(1 / n),
    children: [{ kind: 'leaf', terminalId: first }, buildRowChain(rest)]
  }
}

function buildColChain(terminalIds: string[]): PaneTree {
  const n = terminalIds.length
  if (n === 0) throw new Error('buildColChain: empty list')
  if (n === 1) return { kind: 'leaf', terminalId: terminalIds[0] }
  const first = terminalIds[0]
  const rest = terminalIds.slice(1)
  return {
    kind: 'split',
    orientation: 'column',
    ratio: clampRatio(1 / n),
    children: [{ kind: 'leaf', terminalId: first }, buildColChain(rest)]
  }
}

/**
 * Build a column-of-rows tree from row-major slices.
 * Outer orientation = column (stacks rows vertically); each row is a row-chain.
 * Ratios for the outer column split give each existing row 1/rowsCount.
 */
function buildRowMajor(terminalIds: string[], cols: number): PaneTree {
  const rows: string[][] = []
  for (let i = 0; i < terminalIds.length; i += cols) {
    rows.push(terminalIds.slice(i, i + cols))
  }
  if (rows.length === 1) return buildRowChain(rows[0])

  const rowTrees = rows.map(buildRowChain)
  // Right-leaning column chain of row trees
  const combine = (list: PaneTree[]): PaneTree => {
    if (list.length === 1) return list[0]
    const [first, ...rest] = list
    return {
      kind: 'split',
      orientation: 'column',
      ratio: clampRatio(1 / list.length),
      children: [first, combine(rest)]
    }
  }
  return combine(rowTrees)
}

/**
 * Migrate a flat ordered list of terminal IDs into a binary pane tree that
 * renders identically to the legacy auto-grid for the same (count, orientation).
 *
 * - N=0  → null
 * - N=1  → single leaf
 * - N=2 portrait → column[a, b], landscape → row[a, b]
 * - N≥3 → column of row-chains, last row may be partial
 */
export function migrateFlatToTree(terminalIds: string[], isPortrait: boolean): PaneTree | null {
  const n = terminalIds.length
  if (n === 0) return null
  if (n === 1) return { kind: 'leaf', terminalId: terminalIds[0] }

  const { cols } = calculateGrid(n, isPortrait)

  if (n === 2) {
    return {
      kind: 'split',
      orientation: isPortrait ? 'column' : 'row',
      ratio: 0.5,
      children: [
        { kind: 'leaf', terminalId: terminalIds[0] },
        { kind: 'leaf', terminalId: terminalIds[1] }
      ]
    }
  }

  if (isPortrait) {
    // Portrait: flip rows/cols by treating the list as column-major.
    // Grid row-major → column-major mirror: build columns of column-chains.
    const { rows } = calculateGrid(n, isPortrait)
    const colGroups: string[][] = []
    for (let i = 0; i < terminalIds.length; i += rows) {
      colGroups.push(terminalIds.slice(i, i + rows))
    }
    if (colGroups.length === 1) return buildColChain(colGroups[0])
    const colTrees = colGroups.map(buildColChain)
    const combineRow = (list: PaneTree[]): PaneTree => {
      if (list.length === 1) return list[0]
      const [first, ...rest] = list
      return {
        kind: 'split',
        orientation: 'row',
        ratio: clampRatio(1 / list.length),
        children: [first, combineRow(rest)]
      }
    }
    return combineRow(colTrees)
  }

  return buildRowMajor(terminalIds, cols)
}
