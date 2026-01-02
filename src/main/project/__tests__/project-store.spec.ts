import { describe, it, expect, beforeEach } from 'vitest'
import { ProjectStore } from '../project-store'

// electron-store is already mocked in setup.ts

describe('ProjectStore', () => {
  let store: ProjectStore

  beforeEach(() => {
    store = new ProjectStore()
  })

  describe('Project CRUD', () => {
    it('returns empty array initially', () => {
      expect(store.getProjects()).toEqual([])
    })

    it('adds project with generated id', () => {
      const project = store.addProject({ name: 'Test', path: '/test' })
      expect(project.id).toMatch(/^proj-/)
      expect(project.name).toBe('Test')
      expect(project.path).toBe('/test')
    })

    it('adds project with createdAt and updatedAt timestamps', () => {
      const project = store.addProject({ name: 'Test', path: '/test' })
      expect(project.createdAt).toBeInstanceOf(Date)
      expect(project.updatedAt).toBeInstanceOf(Date)
    })

    it('retrieves project by id', () => {
      const added = store.addProject({ name: 'Test', path: '/test' })
      const found = store.getProject(added.id)
      expect(found).toEqual(added)
    })

    it('returns undefined for non-existent project', () => {
      expect(store.getProject('invalid')).toBeUndefined()
    })

    it('updates project and sets updatedAt', () => {
      const project = store.addProject({ name: 'Test', path: '/test' })
      const originalUpdatedAt = project.updatedAt

      // Small delay to ensure different timestamp
      const updated = store.updateProject(project.id, { name: 'Updated' })
      expect(updated?.name).toBe('Updated')
      expect(updated?.updatedAt.getTime()).toBeGreaterThanOrEqual(originalUpdatedAt.getTime())
    })

    it('returns null when updating non-existent project', () => {
      const result = store.updateProject('invalid', { name: 'Updated' })
      expect(result).toBeNull()
    })

    it('deletes project', () => {
      const project = store.addProject({ name: 'Test', path: '/test' })
      const deleted = store.deleteProject(project.id)
      expect(deleted).toBe(true)
      expect(store.getProject(project.id)).toBeUndefined()
    })

    it('returns false when deleting non-existent project', () => {
      expect(store.deleteProject('invalid')).toBe(false)
    })

    it('clears active project when deleted project was active', () => {
      const project = store.addProject({ name: 'Test', path: '/test' })
      store.setActiveProjectId(project.id)
      expect(store.getActiveProjectId()).toBe(project.id)

      store.deleteProject(project.id)
      expect(store.getActiveProjectId()).toBeNull()
    })
  })

  describe('Active Project', () => {
    it('returns null initially', () => {
      expect(store.getActiveProjectId()).toBeNull()
    })

    it('sets and gets active project id', () => {
      store.setActiveProjectId('test-id')
      expect(store.getActiveProjectId()).toBe('test-id')
    })

    it('allows setting active to null', () => {
      store.setActiveProjectId('test-id')
      store.setActiveProjectId(null)
      expect(store.getActiveProjectId()).toBeNull()
    })
  })

  describe('Session', () => {
    it('returns null initially', () => {
      expect(store.getSession()).toBeNull()
    })

    it('saves and retrieves session', () => {
      const session = { terminals: [], activeTerminalId: null }
      store.saveSession(session as any)
      expect(store.getSession()).toEqual(session)
    })

    it('clears session', () => {
      store.saveSession({ terminals: [] } as any)
      store.clearSession()
      expect(store.getSession()).toBeNull()
    })
  })

  describe('Terminal Layouts', () => {
    it('saves and loads terminal layout', () => {
      const layout = { terminals: [{ id: 't1', title: 'Term 1' }] }
      store.saveTerminalLayout('proj-1', layout as any)
      expect(store.loadTerminalLayout('proj-1')).toEqual(layout)
    })

    it('returns null for non-existent layout', () => {
      expect(store.loadTerminalLayout('invalid')).toBeNull()
    })

    it('deletes terminal layout', () => {
      store.saveTerminalLayout('proj-1', { terminals: [] } as any)
      store.deleteTerminalLayout('proj-1')
      expect(store.loadTerminalLayout('proj-1')).toBeNull()
    })

    it('gets all terminal layouts', () => {
      store.saveTerminalLayout('proj-1', { terminals: [] } as any)
      store.saveTerminalLayout('proj-2', { terminals: [] } as any)
      const layouts = store.getAllTerminalLayouts()
      expect(Object.keys(layouts)).toHaveLength(2)
    })
  })
})
