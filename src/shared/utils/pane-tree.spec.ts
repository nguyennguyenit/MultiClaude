import { describe, it, expect } from 'vitest'
import {
  splitLeaf,
  closeLeafAndCollapse,
  findLeaf,
  countLeaves,
  listLeafIds,
  updateRatio,
  findSplitPath
} from './pane-tree'
import type { PaneLeaf, PaneSplit, PaneTree } from '@shared/types'

function leaf(id: string): PaneLeaf {
  return { kind: 'leaf', terminalId: id }
}

function splitRow(a: PaneTree, b: PaneTree, ratio = 0.5): PaneSplit {
  return { kind: 'split', orientation: 'row', ratio, children: [a, b] }
}

function splitCol(a: PaneTree, b: PaneTree, ratio = 0.5): PaneSplit {
  return { kind: 'split', orientation: 'column', ratio, children: [a, b] }
}

describe('splitLeaf', () => {
  it('splits a single leaf right — new leaf on the right', () => {
    const t = splitLeaf(leaf('a'), 'a', 'right', 'b')
    expect(t).toEqual({
      kind: 'split',
      orientation: 'row',
      ratio: 0.5,
      children: [leaf('a'), leaf('b')]
    })
  })

  it('splits a single leaf left — new leaf on the left', () => {
    const t = splitLeaf(leaf('a'), 'a', 'left', 'b')
    expect((t as PaneSplit).orientation).toBe('row')
    expect((t as PaneSplit).children).toEqual([leaf('b'), leaf('a')])
  })

  it('splits a single leaf down — new leaf below (column orientation)', () => {
    const t = splitLeaf(leaf('a'), 'a', 'down', 'b')
    expect((t as PaneSplit).orientation).toBe('column')
    expect((t as PaneSplit).children).toEqual([leaf('a'), leaf('b')])
  })

  it('splits a single leaf up — new leaf above', () => {
    const t = splitLeaf(leaf('a'), 'a', 'up', 'b')
    expect((t as PaneSplit).orientation).toBe('column')
    expect((t as PaneSplit).children).toEqual([leaf('b'), leaf('a')])
  })

  it('replaces only the target leaf in a nested tree — siblings untouched', () => {
    const tree: PaneTree = splitRow(leaf('a'), splitCol(leaf('b'), leaf('c')))
    const result = splitLeaf(tree, 'c', 'right', 'd') as PaneSplit
    const right = result.children[1] as PaneSplit
    expect(right.orientation).toBe('column')
    const innerB = right.children[0] as PaneLeaf
    const innerSplit = right.children[1] as PaneSplit
    expect(innerB).toEqual(leaf('b'))
    expect(innerSplit.kind).toBe('split')
    expect(innerSplit.orientation).toBe('row')
    expect(innerSplit.children).toEqual([leaf('c'), leaf('d')])
    expect(result.children[0]).toEqual(leaf('a'))
  })

  it('throws when the target leaf does not exist', () => {
    expect(() => splitLeaf(leaf('a'), 'missing', 'right', 'b')).toThrow(/not found/i)
  })

  it('clamps ratio into [0.1, 0.9]', () => {
    const t1 = splitLeaf(leaf('a'), 'a', 'right', 'b', 0.01) as PaneSplit
    expect(t1.ratio).toBe(0.1)
    const t2 = splitLeaf(leaf('a'), 'a', 'right', 'b', 1.5) as PaneSplit
    expect(t2.ratio).toBe(0.9)
    const t3 = splitLeaf(leaf('a'), 'a', 'right', 'b', 0.7) as PaneSplit
    expect(t3.ratio).toBe(0.7)
  })

  it('does not mutate the input tree', () => {
    const inner = splitCol(leaf('b'), leaf('c'))
    const tree = splitRow(leaf('a'), inner)
    const snapshot = JSON.stringify(tree)
    splitLeaf(tree, 'b', 'right', 'x')
    expect(JSON.stringify(tree)).toBe(snapshot)
  })
})

describe('closeLeafAndCollapse', () => {
  it('returns null when closing the only leaf', () => {
    expect(closeLeafAndCollapse(leaf('a'), 'a')).toBeNull()
  })

  it('collapses a split[a, b] down to sibling b when a is closed', () => {
    const tree = splitRow(leaf('a'), leaf('b'))
    expect(closeLeafAndCollapse(tree, 'a')).toEqual(leaf('b'))
  })

  it('collapses a split[a, b] down to sibling a when b is closed', () => {
    const tree = splitRow(leaf('a'), leaf('b'))
    expect(closeLeafAndCollapse(tree, 'b')).toEqual(leaf('a'))
  })

  it('collapses inner split when target is in a nested split', () => {
    const tree = splitRow(leaf('a'), splitCol(leaf('b'), leaf('c')))
    const result = closeLeafAndCollapse(tree, 'b') as PaneSplit
    expect(result.kind).toBe('split')
    expect(result.children).toEqual([leaf('a'), leaf('c')])
  })

  it('recurses collapse upward through multiple levels', () => {
    const tree = splitRow(leaf('a'), splitCol(splitRow(leaf('b'), leaf('c')), leaf('d')))
    const result = closeLeafAndCollapse(tree, 'c') as PaneSplit
    const right = result.children[1] as PaneSplit
    expect(right.orientation).toBe('column')
    expect(right.children).toEqual([leaf('b'), leaf('d')])
  })

  it('returns the tree unchanged when the terminal is not present', () => {
    const tree = splitRow(leaf('a'), leaf('b'))
    expect(closeLeafAndCollapse(tree, 'missing')).toBe(tree)
  })

  it('does not mutate the input tree', () => {
    const tree = splitRow(leaf('a'), splitCol(leaf('b'), leaf('c')))
    const snapshot = JSON.stringify(tree)
    closeLeafAndCollapse(tree, 'b')
    expect(JSON.stringify(tree)).toBe(snapshot)
  })
})

describe('findLeaf / countLeaves / listLeafIds', () => {
  it('findLeaf returns matching leaf or null', () => {
    const tree = splitRow(leaf('a'), splitCol(leaf('b'), leaf('c')))
    expect(findLeaf(tree, 'b')).toEqual(leaf('b'))
    expect(findLeaf(tree, 'missing')).toBeNull()
  })

  it('countLeaves counts only leaf nodes', () => {
    expect(countLeaves(leaf('a'))).toBe(1)
    expect(countLeaves(splitRow(leaf('a'), leaf('b')))).toBe(2)
    expect(countLeaves(splitRow(leaf('a'), splitCol(leaf('b'), leaf('c'))))).toBe(3)
  })

  it('listLeafIds returns IDs in depth-first children[0]-first order', () => {
    const tree = splitRow(splitCol(leaf('a'), leaf('b')), splitRow(leaf('c'), leaf('d')))
    expect(listLeafIds(tree)).toEqual(['a', 'b', 'c', 'd'])
  })
})

describe('updateRatio', () => {
  it('updates ratio at root split', () => {
    const tree = splitRow(leaf('a'), leaf('b'), 0.5)
    const result = updateRatio(tree, [], 0.7) as PaneSplit
    expect(result.ratio).toBe(0.7)
  })

  it('updates ratio at a nested split by path of child indices', () => {
    const tree = splitRow(leaf('a'), splitCol(leaf('b'), leaf('c'), 0.3))
    const result = updateRatio(tree, [1], 0.6) as PaneSplit
    const right = result.children[1] as PaneSplit
    expect(right.ratio).toBe(0.6)
    expect(right.children).toEqual([leaf('b'), leaf('c')])
  })

  it('clamps ratio into [0.1, 0.9]', () => {
    const tree = splitRow(leaf('a'), leaf('b'))
    expect((updateRatio(tree, [], -0.5) as PaneSplit).ratio).toBe(0.1)
    expect((updateRatio(tree, [], 10) as PaneSplit).ratio).toBe(0.9)
  })

  it('returns tree unchanged when path is empty and root is a leaf (stale path during drag)', () => {
    const t = leaf('a')
    expect(updateRatio(t, [], 0.5)).toBe(t)
  })

  it('returns tree unchanged when path traverses into a leaf (stale path during drag)', () => {
    const tree = splitRow(leaf('a'), leaf('b'))
    expect(updateRatio(tree, [0, 0], 0.5)).toBe(tree)
  })

  it('returns tree unchanged when child index is out of range', () => {
    const tree = splitRow(leaf('a'), leaf('b'))
    expect(updateRatio(tree, [5], 0.5)).toBe(tree)
  })

  it('does not mutate the input tree', () => {
    const tree = splitRow(leaf('a'), leaf('b'), 0.5)
    const snapshot = JSON.stringify(tree)
    updateRatio(tree, [], 0.7)
    expect(JSON.stringify(tree)).toBe(snapshot)
  })
})

describe('findSplitPath', () => {
  it('returns [] when root matches predicate', () => {
    const tree = splitRow(leaf('a'), leaf('b'))
    expect(findSplitPath(tree, (s) => s.orientation === 'row')).toEqual([])
  })

  it('returns child index path when a nested split matches', () => {
    const tree = splitRow(leaf('a'), splitCol(leaf('b'), leaf('c')))
    expect(findSplitPath(tree, (s) => s.orientation === 'column')).toEqual([1])
  })

  it('returns null when no split matches', () => {
    expect(findSplitPath(leaf('a'), () => true)).toBeNull()
  })
})
