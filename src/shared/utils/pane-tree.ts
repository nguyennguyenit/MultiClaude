import {
  PANE_RATIO_MAX,
  PANE_RATIO_MIN,
  type PaneLeaf,
  type PaneSplit,
  type PaneSplitDirection,
  type PaneTree
} from '@shared/types'

function clampRatio(r: number): number {
  if (Number.isNaN(r)) return 0.5
  if (r < PANE_RATIO_MIN) return PANE_RATIO_MIN
  if (r > PANE_RATIO_MAX) return PANE_RATIO_MAX
  return r
}

export function countLeaves(tree: PaneTree): number {
  if (tree.kind === 'leaf') return 1
  return countLeaves(tree.children[0]) + countLeaves(tree.children[1])
}

export function listLeafIds(tree: PaneTree): string[] {
  if (tree.kind === 'leaf') return [tree.terminalId]
  return [...listLeafIds(tree.children[0]), ...listLeafIds(tree.children[1])]
}

export function findLeaf(tree: PaneTree, terminalId: string): PaneLeaf | null {
  if (tree.kind === 'leaf') {
    return tree.terminalId === terminalId ? tree : null
  }
  return findLeaf(tree.children[0], terminalId) ?? findLeaf(tree.children[1], terminalId)
}

export function splitLeaf(
  tree: PaneTree,
  targetTerminalId: string,
  direction: PaneSplitDirection,
  newTerminalId: string,
  ratio = 0.5
): PaneTree {
  if (!findLeaf(tree, targetTerminalId)) {
    throw new Error(`splitLeaf: target leaf "${targetTerminalId}" not found`)
  }
  return replaceLeaf(tree, targetTerminalId, (target) =>
    buildSplit(target, { kind: 'leaf', terminalId: newTerminalId }, direction, ratio)
  )
}

function buildSplit(
  target: PaneLeaf,
  fresh: PaneLeaf,
  direction: PaneSplitDirection,
  ratio: number
): PaneSplit {
  const clamped = clampRatio(ratio)
  if (direction === 'right') {
    return { kind: 'split', orientation: 'row', ratio: clamped, children: [target, fresh] }
  }
  if (direction === 'left') {
    return { kind: 'split', orientation: 'row', ratio: clamped, children: [fresh, target] }
  }
  if (direction === 'down') {
    return { kind: 'split', orientation: 'column', ratio: clamped, children: [target, fresh] }
  }
  return { kind: 'split', orientation: 'column', ratio: clamped, children: [fresh, target] }
}

function replaceLeaf(
  tree: PaneTree,
  terminalId: string,
  replacer: (leaf: PaneLeaf) => PaneTree
): PaneTree {
  if (tree.kind === 'leaf') {
    return tree.terminalId === terminalId ? replacer(tree) : tree
  }
  const [a, b] = tree.children
  const nextA = replaceLeaf(a, terminalId, replacer)
  const nextB = nextA === a ? replaceLeaf(b, terminalId, replacer) : b
  if (nextA === a && nextB === b) return tree
  return { ...tree, children: [nextA, nextB] }
}

export function closeLeafAndCollapse(tree: PaneTree, terminalId: string): PaneTree | null {
  if (!findLeaf(tree, terminalId)) return tree
  return removeLeaf(tree, terminalId)
}

function removeLeaf(tree: PaneTree, terminalId: string): PaneTree | null {
  if (tree.kind === 'leaf') {
    return tree.terminalId === terminalId ? null : tree
  }
  const [a, b] = tree.children
  const nextA = removeLeaf(a, terminalId)
  if (nextA === null) return b
  if (nextA !== a) {
    return { ...tree, children: [nextA, b] }
  }
  const nextB = removeLeaf(b, terminalId)
  if (nextB === null) return a
  if (nextB !== b) {
    return { ...tree, children: [a, nextB] }
  }
  return tree
}

export function updateRatio(tree: PaneTree, splitPath: number[], ratio: number): PaneTree {
  if (tree.kind === 'leaf') {
    throw new Error('updateRatio: cannot update ratio on a leaf')
  }
  if (splitPath.length === 0) {
    return { ...tree, ratio: clampRatio(ratio) }
  }
  const [step, ...rest] = splitPath
  if (step !== 0 && step !== 1) {
    throw new Error(`updateRatio: invalid child index ${step}`)
  }
  const child = tree.children[step]
  const updatedChild = updateRatio(child, rest, ratio)
  const nextChildren: [PaneTree, PaneTree] = step === 0 ? [updatedChild, tree.children[1]] : [tree.children[0], updatedChild]
  return { ...tree, children: nextChildren }
}

export function findSplitPath(
  tree: PaneTree,
  predicate: (split: PaneSplit) => boolean
): number[] | null {
  if (tree.kind === 'leaf') return null
  if (predicate(tree)) return []
  const leftPath = findSplitPath(tree.children[0], predicate)
  if (leftPath) return [0, ...leftPath]
  const rightPath = findSplitPath(tree.children[1], predicate)
  if (rightPath) return [1, ...rightPath]
  return null
}
