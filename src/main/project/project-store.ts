import Store from 'electron-store'
import type { Project, AppSession, ProjectTerminalLayout } from '@shared/types'

interface StoreSchema {
  projects: Project[]
  activeProjectId: string | null
  session: AppSession | null
  terminalLayouts: Record<string, ProjectTerminalLayout>
}

export class ProjectStore {
  private store: Store<StoreSchema>

  constructor() {
    this.store = new Store<StoreSchema>({
      name: 'multiclaude-data',
      defaults: {
        projects: [],
        activeProjectId: null,
        session: null,
        terminalLayouts: {}
      }
    })
  }

  // Project methods
  getProjects(): Project[] {
    return this.store.get('projects')
  }

  getProject(id: string): Project | undefined {
    return this.getProjects().find(p => p.id === id)
  }

  addProject(project: Omit<Project, 'id' | 'createdAt' | 'updatedAt'>): Project {
    const newProject: Project = {
      ...project,
      id: `proj-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      createdAt: new Date(),
      updatedAt: new Date()
    }

    const projects = this.getProjects()
    projects.push(newProject)
    this.store.set('projects', projects)

    return newProject
  }

  updateProject(id: string, updates: Partial<Project>): Project | null {
    const projects = this.getProjects()
    const index = projects.findIndex(p => p.id === id)
    if (index === -1) return null

    projects[index] = {
      ...projects[index],
      ...updates,
      updatedAt: new Date()
    }
    this.store.set('projects', projects)
    return projects[index]
  }

  deleteProject(id: string): boolean {
    const projects = this.getProjects()
    const filtered = projects.filter(p => p.id !== id)
    if (filtered.length === projects.length) return false

    this.store.set('projects', filtered)

    // Clear active if it was deleted
    if (this.store.get('activeProjectId') === id) {
      this.store.set('activeProjectId', null)
    }

    // Clean up associated terminal layout
    this.deleteTerminalLayout(id)

    return true
  }

  getActiveProjectId(): string | null {
    return this.store.get('activeProjectId')
  }

  setActiveProjectId(id: string | null): void {
    this.store.set('activeProjectId', id)
  }

  // Session methods
  saveSession(session: AppSession): void {
    this.store.set('session', session)
  }

  getSession(): AppSession | null {
    return this.store.get('session')
  }

  clearSession(): void {
    this.store.set('session', null)
  }

  // Terminal layout methods
  saveTerminalLayout(projectId: string, layout: ProjectTerminalLayout): void {
    const layouts = this.store.get('terminalLayouts')
    layouts[projectId] = layout
    this.store.set('terminalLayouts', layouts)
  }

  loadTerminalLayout(projectId: string): ProjectTerminalLayout | null {
    const layouts = this.store.get('terminalLayouts')
    return layouts[projectId] || null
  }

  deleteTerminalLayout(projectId: string): void {
    const layouts = this.store.get('terminalLayouts')
    delete layouts[projectId]
    this.store.set('terminalLayouts', layouts)
  }

  getAllTerminalLayouts(): Record<string, ProjectTerminalLayout> {
    return this.store.get('terminalLayouts')
  }
}
