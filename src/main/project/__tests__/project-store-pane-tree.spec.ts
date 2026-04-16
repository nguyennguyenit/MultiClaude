import { describe, it, expect, beforeEach } from 'vitest'
import { ProjectStore } from '../project-store'
import type { PaneTree, ProjectTerminalLayout } from '@shared/types'

function legacyLayout(projectId: string, ids: string[]): ProjectTerminalLayout {
  return {
    projectId,
    terminals: ids.map((id, index) => ({ id, title: id, position: index }))
  }
}

describe('ProjectStore — paneTree', () => {
  let store: ProjectStore

  beforeEach(() => {
    store = new ProjectStore()
  })

  describe('loadPaneTree', () => {
    it('returns null when no layout exists for projectId', () => {
      expect(store.loadPaneTree('missing')).toBeNull()
    })

    it('returns the stored paneTree when schemaVersion is 2', () => {
      const tree: PaneTree = { kind: 'leaf', terminalId: 'a' }
      store.saveTerminalLayout('p1', {
        projectId: 'p1',
        terminals: [{ id: 'a', title: 'a', position: 0 }],
        paneTree: tree,
        schemaVersion: 2
      })
      expect(store.loadPaneTree('p1')).toEqual(tree)
    })

    it('migrates a legacy layout (no schemaVersion, no paneTree) into a tree', () => {
      store.saveTerminalLayout('p1', legacyLayout('p1', ['a', 'b', 'c']))
      const tree = store.loadPaneTree('p1')
      expect(tree).not.toBeNull()
      if (tree && tree.kind !== 'leaf') {
        expect(tree.children.length).toBe(2)
      }
    })

    it('migration persists the new tree + schemaVersion back to store', () => {
      store.saveTerminalLayout('p1', legacyLayout('p1', ['a', 'b']))
      store.loadPaneTree('p1')
      const stored = store.loadTerminalLayout('p1')
      expect(stored?.schemaVersion).toBe(2)
      expect(stored?.paneTree).toBeDefined()
    })

    it('migration is idempotent (second call reuses existing tree)', () => {
      store.saveTerminalLayout('p1', legacyLayout('p1', ['a', 'b', 'c']))
      const first = store.loadPaneTree('p1')
      const second = store.loadPaneTree('p1')
      expect(second).toEqual(first)
    })

    it('returns null when legacy layout has no terminals', () => {
      store.saveTerminalLayout('p1', { projectId: 'p1', terminals: [] })
      expect(store.loadPaneTree('p1')).toBeNull()
    })
  })

  describe('savePaneTree', () => {
    it('persists a tree so it is returned on next load', () => {
      store.saveTerminalLayout('p1', {
        projectId: 'p1',
        terminals: [{ id: 'a', title: 'a', position: 0 }]
      })
      const tree: PaneTree = {
        kind: 'split',
        orientation: 'row',
        ratio: 0.5,
        children: [
          { kind: 'leaf', terminalId: 'a' },
          { kind: 'leaf', terminalId: 'b' }
        ]
      }
      store.savePaneTree('p1', tree)
      expect(store.loadPaneTree('p1')).toEqual(tree)
    })

    it('saves null when clearing the tree', () => {
      store.saveTerminalLayout('p1', { projectId: 'p1', terminals: [] })
      store.savePaneTree('p1', null)
      expect(store.loadPaneTree('p1')).toBeNull()
    })

    it('sets schemaVersion to 2', () => {
      store.saveTerminalLayout('p1', legacyLayout('p1', ['a']))
      store.savePaneTree('p1', { kind: 'leaf', terminalId: 'a' })
      const layout = store.loadTerminalLayout('p1')
      expect(layout?.schemaVersion).toBe(2)
    })

    it('preserves existing terminals[] field', () => {
      const legacy = legacyLayout('p1', ['a', 'b'])
      store.saveTerminalLayout('p1', legacy)
      store.savePaneTree('p1', {
        kind: 'split',
        orientation: 'row',
        ratio: 0.5,
        children: [
          { kind: 'leaf', terminalId: 'a' },
          { kind: 'leaf', terminalId: 'b' }
        ]
      })
      const layout = store.loadTerminalLayout('p1')
      expect(layout?.terminals).toEqual(legacy.terminals)
    })

    it('creates layout shell when project has none yet', () => {
      store.savePaneTree('p1', { kind: 'leaf', terminalId: 'a' })
      const layout = store.loadTerminalLayout('p1')
      expect(layout?.projectId).toBe('p1')
      expect(layout?.paneTree).toEqual({ kind: 'leaf', terminalId: 'a' })
    })

    it('rejects malformed tree shapes (defensive against IPC tampering)', () => {
      store.saveTerminalLayout('p1', legacyLayout('p1', ['a']))
      // Missing `kind`
      store.savePaneTree('p1', { children: [] } as unknown as PaneTree)
      expect(store.loadTerminalLayout('p1')?.paneTree).toBeUndefined()

      // Leaf without terminalId
      store.savePaneTree('p1', { kind: 'leaf' } as unknown as PaneTree)
      expect(store.loadTerminalLayout('p1')?.paneTree).toBeUndefined()

      // Split with only one child
      store.savePaneTree('p1', {
        kind: 'split',
        orientation: 'row',
        ratio: 0.5,
        children: [{ kind: 'leaf', terminalId: 'a' }]
      } as unknown as PaneTree)
      expect(store.loadTerminalLayout('p1')?.paneTree).toBeUndefined()

      // Split with out-of-range ratio
      store.savePaneTree('p1', {
        kind: 'split',
        orientation: 'row',
        ratio: 5,
        children: [
          { kind: 'leaf', terminalId: 'a' },
          { kind: 'leaf', terminalId: 'b' }
        ]
      })
      expect(store.loadTerminalLayout('p1')?.paneTree).toBeUndefined()
    })

    it('rejects empty projectId without throwing', () => {
      expect(() =>
        store.savePaneTree('', { kind: 'leaf', terminalId: 'a' })
      ).not.toThrow()
    })

    it('refuses to overwrite a forward-compat higher schemaVersion (avoids silent downgrade)', () => {
      // Seed a layout whose schemaVersion is newer than this build knows how
      // to write. A downgraded user opening the file must not clobber it with
      // a v2 payload that drops v3-only fields.
      const futureLayout: ProjectTerminalLayout & { schemaVersion: number } = {
        projectId: 'p1',
        terminals: [],
        paneTree: { kind: 'leaf', terminalId: 'future' },
        schemaVersion: 99
      }
      store.saveTerminalLayout('p1', futureLayout)

      store.savePaneTree('p1', { kind: 'leaf', terminalId: 'a' })

      const layout = store.loadTerminalLayout('p1') as typeof futureLayout
      expect(layout.schemaVersion).toBe(99)
      expect(layout.paneTree).toEqual({ kind: 'leaf', terminalId: 'future' })
    })

    it('validator rejects pathologically deep trees without stack overflow (depth cap)', () => {
      // Build a 200-level right-leaning spine. Without a depth cap, recursive
      // isValidPaneTree could blow the stack. With the cap, save is refused.
      let node: PaneTree = { kind: 'leaf', terminalId: 'leaf' }
      for (let i = 0; i < 200; i++) {
        node = {
          kind: 'split',
          orientation: 'row',
          ratio: 0.5,
          children: [{ kind: 'leaf', terminalId: `l${i}` }, node]
        }
      }
      store.saveTerminalLayout('p1', legacyLayout('p1', ['a']))

      expect(() => store.savePaneTree('p1', node)).not.toThrow()
      expect(store.loadTerminalLayout('p1')?.paneTree).toBeUndefined()
    })
  })
})
