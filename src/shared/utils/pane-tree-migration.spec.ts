import { describe, it, expect } from 'vitest'
import { migrateFlatToTree } from './pane-tree-migration'
import { countLeaves, listLeafIds } from './pane-tree'
import type { PaneLeaf, PaneSplit, PaneTree } from '@shared/types'

const ids = (n: number): string[] => Array.from({ length: n }, (_, i) => `t${i + 1}`)

function isLeaf(tree: PaneTree): tree is PaneLeaf {
  return tree.kind === 'leaf'
}
function isSplit(tree: PaneTree): tree is PaneSplit {
  return tree.kind === 'split'
}

describe('migrateFlatToTree', () => {
  it('returns null for N=0', () => {
    expect(migrateFlatToTree([], false)).toBeNull()
    expect(migrateFlatToTree([], true)).toBeNull()
  })

  it('returns a single leaf for N=1', () => {
    const tree = migrateFlatToTree(['only'], false) as PaneTree
    expect(isLeaf(tree)).toBe(true)
    expect((tree as PaneLeaf).terminalId).toBe('only')
  })

  it('portrait N=2 stacks vertically (column)', () => {
    const tree = migrateFlatToTree(ids(2), true) as PaneSplit
    expect(tree.orientation).toBe('column')
    expect(listLeafIds(tree)).toEqual(ids(2))
  })

  it('landscape N=2 side-by-side (row)', () => {
    const tree = migrateFlatToTree(ids(2), false) as PaneSplit
    expect(tree.orientation).toBe('row')
    expect(listLeafIds(tree)).toEqual(ids(2))
  })

  it.each([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12])(
    'N=%i preserves leaf order and leaf count in landscape',
    (n) => {
      const tree = migrateFlatToTree(ids(n), false) as PaneTree
      expect(countLeaves(tree)).toBe(n)
      expect(listLeafIds(tree)).toEqual(ids(n))
    }
  )

  it.each([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12])(
    'N=%i preserves leaf order and leaf count in portrait',
    (n) => {
      const tree = migrateFlatToTree(ids(n), true) as PaneTree
      expect(countLeaves(tree)).toBe(n)
      expect(listLeafIds(tree)).toEqual(ids(n))
    }
  )

  it('N=4 landscape builds a 2x2 grid — outer column split, two row children', () => {
    const tree = migrateFlatToTree(ids(4), false) as PaneSplit
    expect(tree.orientation).toBe('column')
    const top = tree.children[0] as PaneSplit
    const bottom = tree.children[1] as PaneSplit
    expect(top.orientation).toBe('row')
    expect(bottom.orientation).toBe('row')
    expect(listLeafIds(top)).toEqual(['t1', 't2'])
    expect(listLeafIds(bottom)).toEqual(['t3', 't4'])
  })

  it('N=3 landscape builds 2 rows with last row partial (one leaf)', () => {
    const tree = migrateFlatToTree(ids(3), false) as PaneSplit
    expect(tree.orientation).toBe('column')
    const top = tree.children[0]
    const bottom = tree.children[1]
    expect(isSplit(top) && top.orientation === 'row').toBe(true)
    expect(listLeafIds(top)).toEqual(['t1', 't2'])
    expect(isLeaf(bottom)).toBe(true)
    expect((bottom as PaneLeaf).terminalId).toBe('t3')
  })

  it('ratios are within [0.1, 0.9]', () => {
    const tree = migrateFlatToTree(ids(9), false) as PaneTree
    const ratios: number[] = []
    const walk = (t: PaneTree): void => {
      if (t.kind === 'split') {
        ratios.push(t.ratio)
        walk(t.children[0])
        walk(t.children[1])
      }
    }
    walk(tree)
    for (const r of ratios) {
      expect(r).toBeGreaterThanOrEqual(0.1)
      expect(r).toBeLessThanOrEqual(0.9)
    }
  })

  it('dedups duplicate terminal ids — keeps each leaf id unique', () => {
    const tree = migrateFlatToTree(['t1', 't2', 't1', 't3', 't2'], false) as PaneTree
    const leaves = listLeafIds(tree)
    expect(leaves).toEqual(['t1', 't2', 't3'])
    expect(new Set(leaves).size).toBe(leaves.length)
  })

  it('drops empty / falsy terminal ids', () => {
    const tree = migrateFlatToTree(['t1', '', 't2'], false) as PaneTree
    expect(listLeafIds(tree)).toEqual(['t1', 't2'])
  })

  it('returns null when only duplicates / empties collapse to zero leaves', () => {
    expect(migrateFlatToTree(['', '', ''], false)).toBeNull()
  })

  it('returns single leaf when dedup leaves only one id', () => {
    const tree = migrateFlatToTree(['t1', 't1', 't1'], false) as PaneTree
    expect(tree.kind).toBe('leaf')
    expect((tree as PaneLeaf).terminalId).toBe('t1')
  })
})
