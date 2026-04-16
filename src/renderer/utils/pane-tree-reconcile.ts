import {
  closeLeafAndCollapse,
  listLeafIds,
  splitLeaf
} from '@shared/utils/pane-tree'
import { migrateFlatToTree } from '@shared/utils/pane-tree-migration'
import type { PaneTree } from '@shared/types'

/**
 * Reconcile a persisted pane tree against the live list of terminal IDs for a
 * project. Terminals added outside tree control (e.g. via the + button) are
 * appended by splitting the rightmost leaf. Terminals that are no longer alive
 * are closed from the tree (with upward collapse). Duplicate leaves for the
 * same terminal id are also collapsed to one — they can persist on disk from
 * older builds and would otherwise mount the same TerminalView twice, causing
 * doubled output and ghost rendering.
 *
 * Pure — does not mutate `tree`.
 */
export function reconcilePaneTree(
  tree: PaneTree | null,
  liveTerminalIds: string[],
  isPortrait: boolean
): PaneTree | null {
  if (liveTerminalIds.length === 0) return null

  if (!tree) return migrateFlatToTree(liveTerminalIds, isPortrait)

  const liveSet = new Set(liveTerminalIds)
  const allLeafIds = listLeafIds(tree)
  const present = new Set(allLeafIds)

  let next: PaneTree | null = tree

  // Collapse duplicate leaves: keep the first occurrence (DFS-left order),
  // remove the rest. Each closeLeafAndCollapse strips the first match found,
  // so calling (count - 1) times leaves exactly one leaf for each id.
  const counts = new Map<string, number>()
  for (const id of allLeafIds) counts.set(id, (counts.get(id) ?? 0) + 1)
  for (const [id, count] of counts) {
    for (let i = 0; i < count - 1; i++) {
      if (!next) break
      next = closeLeafAndCollapse(next, id)
    }
    if (!next) break
  }

  if (!next) return migrateFlatToTree(liveTerminalIds, isPortrait)

  // Remove dead leaves (present in tree but not alive)
  for (const id of present) {
    if (!liveSet.has(id)) {
      next = closeLeafAndCollapse(next!, id)
      if (!next) break
    }
  }

  if (!next) {
    return migrateFlatToTree(liveTerminalIds, isPortrait)
  }

  // Append new leaves (alive but not in tree) to the rightmost leaf
  for (const id of liveTerminalIds) {
    if (!present.has(id)) {
      const currentLeaves = listLeafIds(next)
      if (currentLeaves.length === 0) {
        next = { kind: 'leaf', terminalId: id }
        continue
      }
      const lastLeaf = currentLeaves[currentLeaves.length - 1]
      next = splitLeaf(next, lastLeaf, 'right', id)
    }
  }

  return next
}
