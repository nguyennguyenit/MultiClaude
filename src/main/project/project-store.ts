import Store from 'electron-store'
import type { Project, AppSession, ProjectTerminalLayout, PaneTree } from '@shared/types'
import { migrateFlatToTree } from '@shared/utils/pane-tree-migration'
import { PANE_RATIO_MAX, PANE_RATIO_MIN } from '@shared/types'

const PANE_TREE_SCHEMA_VERSION = 2

/**
 * Upper bound on split-tree depth the validator will descend. Real trees are
 * bounded by the terminal limit (≤ 12), so 32 is a generous guard that still
 * prevents a malicious/malformed IPC payload from stack-overflowing the
 * main process via unbounded recursion.
 */
const MAX_TREE_DEPTH = 32

function isValidPaneTree(node: unknown, depth = 0): node is PaneTree {
  if (depth > MAX_TREE_DEPTH) return false
  if (!node || typeof node !== 'object') return false
  const n = node as { kind?: unknown }
  if (n.kind === 'leaf') {
    const leaf = node as { terminalId?: unknown }
    return typeof leaf.terminalId === 'string' && leaf.terminalId.length > 0
  }
  if (n.kind === 'split') {
    const split = node as { orientation?: unknown; ratio?: unknown; children?: unknown }
    if (split.orientation !== 'row' && split.orientation !== 'column') return false
    if (typeof split.ratio !== 'number' || !Number.isFinite(split.ratio)) return false
    if (split.ratio < PANE_RATIO_MIN - 1e-9 || split.ratio > PANE_RATIO_MAX + 1e-9) return false
    if (!Array.isArray(split.children) || split.children.length !== 2) return false
    return isValidPaneTree(split.children[0], depth + 1) && isValidPaneTree(split.children[1], depth + 1)
  }
  return false
}

interface StoreSchema {
  projects: Project[]
  activeProjectId: string | null
  session: AppSession | null
  terminalLayouts: Record<string, ProjectTerminalLayout>
}

export class ProjectStore {
  private store: Store<StoreSchema>
  private migrationDone = new Set<string>()

  constructor() {
    // In test mode, use test-specific store path from environment variable
    const cwd = process.env.MULTICLAUDE_TEST_STORE_PATH || undefined

    this.store = new Store<StoreSchema>({
      name: 'multiclaude-data',
      cwd,
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

  loadPaneTree(projectId: string): PaneTree | null {
    const layouts = this.store.get('terminalLayouts')
    const layout = layouts[projectId]
    if (!layout) return null

    if (layout.paneTree) return layout.paneTree
    if ((layout.schemaVersion ?? 1) >= PANE_TREE_SCHEMA_VERSION) return null

    if (!layout.terminals || layout.terminals.length === 0) return null

    // Serialize per-project migration within this process. electron-store's
    // read-modify-write cycle is synchronous so JS's event loop alone already
    // prevents interleaving, but this Set makes the once-only intent explicit
    // and protects against any future async migration path from racing two
    // callers (e.g. two windows both hitting terminal:load-pane-tree).
    if (this.migrationDone.has(projectId)) return null
    this.migrationDone.add(projectId)

    const ids = layout.terminals.map((t) => t.id)
    const migrated = migrateFlatToTree(ids, false)
    if (!migrated) return null

    layouts[projectId] = {
      ...layout,
      paneTree: migrated,
      schemaVersion: PANE_TREE_SCHEMA_VERSION
    }
    this.store.set('terminalLayouts', layouts)
    return migrated
  }

  savePaneTree(projectId: string, tree: PaneTree | null): void {
    if (typeof projectId !== 'string' || projectId.length === 0) return
    if (tree !== null && !isValidPaneTree(tree)) {
      console.warn('[project-store] savePaneTree: rejected invalid tree shape for', projectId)
      return
    }
    const layouts = this.store.get('terminalLayouts')
    const existing = layouts[projectId]
    const existingVersion = existing?.schemaVersion ?? 1
    // Forward-compat guard: if a future build wrote schemaVersion=N > current,
    // refuse to downgrade. Overwriting with v2 would silently drop whatever
    // vN-only fields the future build added.
    if (existingVersion > PANE_TREE_SCHEMA_VERSION) {
      console.warn(
        `[project-store] savePaneTree: refusing to overwrite schemaVersion=${existingVersion} with v${PANE_TREE_SCHEMA_VERSION} for`,
        projectId
      )
      return
    }
    layouts[projectId] = {
      ...(existing ?? { projectId, terminals: [] }),
      projectId,
      paneTree: tree,
      schemaVersion: PANE_TREE_SCHEMA_VERSION
    }
    this.store.set('terminalLayouts', layouts)
  }
}
