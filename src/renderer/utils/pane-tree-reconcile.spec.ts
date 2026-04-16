import { describe, it, expect } from 'vitest'
import { reconcilePaneTree } from './pane-tree-reconcile'
import { countLeaves, listLeafIds } from '@shared/utils/pane-tree'
import type { PaneTree } from '@shared/types'

function leaf(id: string): PaneTree {
  return { kind: 'leaf', terminalId: id }
}

describe('reconcilePaneTree', () => {
  it('returns null when no live terminals', () => {
    expect(reconcilePaneTree(leaf('a'), [], false)).toBeNull()
  })

  it('builds a new tree from migration when tree is null', () => {
    const tree = reconcilePaneTree(null, ['a', 'b', 'c'], false)
    expect(tree).not.toBeNull()
    expect(countLeaves(tree!)).toBe(3)
  })

  it('returns the same tree when leaves already match live terminals', () => {
    const tree: PaneTree = {
      kind: 'split',
      orientation: 'row',
      ratio: 0.5,
      children: [leaf('a'), leaf('b')]
    }
    const result = reconcilePaneTree(tree, ['a', 'b'], false)
    expect(result).toBe(tree)
  })

  it('removes dead leaves (terminals no longer alive)', () => {
    const tree: PaneTree = {
      kind: 'split',
      orientation: 'row',
      ratio: 0.5,
      children: [leaf('a'), leaf('b')]
    }
    const result = reconcilePaneTree(tree, ['a'], false)
    expect(result).toEqual(leaf('a'))
  })

  it('appends new terminals by splitting the last leaf right', () => {
    const result = reconcilePaneTree(leaf('a'), ['a', 'b'], false)
    expect(result).not.toBeNull()
    expect(listLeafIds(result!)).toEqual(['a', 'b'])
  })

  it('handles both removals and additions in one pass', () => {
    const tree: PaneTree = {
      kind: 'split',
      orientation: 'row',
      ratio: 0.5,
      children: [leaf('a'), leaf('b')]
    }
    const result = reconcilePaneTree(tree, ['a', 'c'], false)
    expect(result).not.toBeNull()
    expect(listLeafIds(result!)).toEqual(['a', 'c'])
  })

  it('rebuilds tree when all leaves become dead but terminals still exist', () => {
    const tree: PaneTree = {
      kind: 'split',
      orientation: 'row',
      ratio: 0.5,
      children: [leaf('x'), leaf('y')]
    }
    const result = reconcilePaneTree(tree, ['a'], false)
    expect(result).toEqual(leaf('a'))
  })
})
