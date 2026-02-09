---
title: "Phase 4: Project Management"
status: pending
priority: P2
effort: 8h
---

# Phase 4: Project Management

> Context: [plan.md](./plan.md) | [Phase 3](./phase-03-git-github-integration.md)

## Overview
| Field | Value |
|-------|-------|
| Date | 2025-12-30 |
| Priority | P2 - Important |
| Status | Pending |
| Effort | 8h |

## Objective
Implement project CRUD operations with persistent storage and seamless switching.

## Requirements
- R1: Create new projects (with directory picker)
- R2: Open existing projects
- R3: List all projects in sidebar
- R4: Switch between projects (updates all terminals)
- R5: Delete/archive projects
- R6: Persist project list across app restarts
- R7: Remember last active project

## Architecture

### Project Data Model
```typescript
interface Project {
  id: string
  name: string
  path: string
  createdAt: Date
  lastOpenedAt: Date
  gitRemote?: string
  color?: string  // For visual distinction
}

interface ProjectStore {
  projects: Project[]
  activeProjectId: string | null
  recentProjectIds: string[]  // Last 5
}
```

### Storage Strategy
Using `electron-store` for JSON persistence in app data directory.
```
~/.config/multiclaude/
└── projects.json
```

### IPC Channels
| Channel | Direction | Payload |
|---------|-----------|---------|
| `project:list` | renderer→main | `{}` → `Project[]` |
| `project:create` | renderer→main | `{ name, path }` → `Project` |
| `project:open` | renderer→main | `{ id }` |
| `project:delete` | renderer→main | `{ id }` |
| `project:pick-directory` | renderer→main | `{}` → `{ path }` |
| `project:get-active` | renderer→main | `{}` → `Project | null` |

## Implementation Steps

### Step 1: Install Dependencies (15m)
```bash
npm i electron-store
npm i -D @types/electron-store  # if needed
```

### Step 2: Create Project Store (Main Process) (2h)
`src/main/project/project-store.ts`:
```typescript
import Store from 'electron-store'
import { randomUUID } from 'crypto'

export interface Project {
  id: string
  name: string
  path: string
  createdAt: string
  lastOpenedAt: string
  gitRemote?: string
  color?: string
}

interface StoreSchema {
  projects: Project[]
  activeProjectId: string | null
  recentProjectIds: string[]
}

const store = new Store<StoreSchema>({
  name: 'projects',
  defaults: {
    projects: [],
    activeProjectId: null,
    recentProjectIds: []
  }
})

export class ProjectStore {
  getAll(): Project[] {
    return store.get('projects')
  }

  getById(id: string): Project | undefined {
    return this.getAll().find(p => p.id === id)
  }

  getActive(): Project | null {
    const activeId = store.get('activeProjectId')
    if (!activeId) return null
    return this.getById(activeId) || null
  }

  create(name: string, path: string): Project {
    const project: Project = {
      id: randomUUID(),
      name,
      path,
      createdAt: new Date().toISOString(),
      lastOpenedAt: new Date().toISOString()
    }

    const projects = this.getAll()
    projects.push(project)
    store.set('projects', projects)

    this.setActive(project.id)
    return project
  }

  setActive(id: string): void {
    const project = this.getById(id)
    if (!project) return

    // Update lastOpenedAt
    const projects = this.getAll().map(p =>
      p.id === id
        ? { ...p, lastOpenedAt: new Date().toISOString() }
        : p
    )
    store.set('projects', projects)
    store.set('activeProjectId', id)

    // Update recent list
    const recent = store.get('recentProjectIds').filter(rid => rid !== id)
    recent.unshift(id)
    store.set('recentProjectIds', recent.slice(0, 5))
  }

  update(id: string, updates: Partial<Project>): Project | null {
    const projects = this.getAll().map(p =>
      p.id === id ? { ...p, ...updates } : p
    )
    store.set('projects', projects)
    return this.getById(id) || null
  }

  delete(id: string): void {
    const projects = this.getAll().filter(p => p.id !== id)
    store.set('projects', projects)

    // Clear active if deleted
    if (store.get('activeProjectId') === id) {
      store.set('activeProjectId', projects[0]?.id || null)
    }

    // Remove from recent
    const recent = store.get('recentProjectIds').filter(rid => rid !== id)
    store.set('recentProjectIds', recent)
  }

  getRecent(): Project[] {
    const recentIds = store.get('recentProjectIds')
    return recentIds
      .map(id => this.getById(id))
      .filter((p): p is Project => p !== undefined)
  }
}

export const projectStore = new ProjectStore()
```

### Step 3: Create IPC Handlers (1h)
`src/main/ipc/project-handlers.ts`:
```typescript
import { ipcMain, dialog } from 'electron'
import { projectStore } from '../project/project-store'
import { terminalManager } from '../terminal/terminal-manager'

export function registerProjectHandlers() {
  ipcMain.handle('project:list', () => {
    return projectStore.getAll()
  })

  ipcMain.handle('project:get-active', () => {
    return projectStore.getActive()
  })

  ipcMain.handle('project:get-recent', () => {
    return projectStore.getRecent()
  })

  ipcMain.handle('project:create', (_, { name, path }) => {
    return projectStore.create(name, path)
  })

  ipcMain.handle('project:open', async (_, { id }) => {
    projectStore.setActive(id)

    // Close existing terminals, open new ones for this project
    terminalManager.destroyAll()

    const project = projectStore.getById(id)
    if (project) {
      // Create initial terminal for new project
      terminalManager.create(project.path)
    }

    return project
  })

  ipcMain.handle('project:delete', (_, { id }) => {
    projectStore.delete(id)
    return { success: true }
  })

  ipcMain.handle('project:pick-directory', async (event) => {
    const result = await dialog.showOpenDialog({
      properties: ['openDirectory', 'createDirectory']
    })

    if (result.canceled || result.filePaths.length === 0) {
      return { path: null }
    }

    return { path: result.filePaths[0] }
  })

  ipcMain.handle('project:update', (_, { id, updates }) => {
    return projectStore.update(id, updates)
  })
}
```

### Step 4: Update Preload (30m)
Add to `src/preload/index.ts`:
```typescript
project: {
  list: () => ipcRenderer.invoke('project:list'),
  getActive: () => ipcRenderer.invoke('project:get-active'),
  getRecent: () => ipcRenderer.invoke('project:get-recent'),
  create: (name: string, path: string) =>
    ipcRenderer.invoke('project:create', { name, path }),
  open: (id: string) => ipcRenderer.invoke('project:open', { id }),
  delete: (id: string) => ipcRenderer.invoke('project:delete', { id }),
  pickDirectory: () => ipcRenderer.invoke('project:pick-directory'),
  update: (id: string, updates: Partial<Project>) =>
    ipcRenderer.invoke('project:update', { id, updates })
}
```

### Step 5: Create Project Store (Renderer) (1h)
`src/renderer/stores/project-store.ts`:
```typescript
import { create } from 'zustand'
import type { Project } from '../../shared/types'

interface ProjectState {
  projects: Project[]
  activeProject: Project | null
  loading: boolean

  loadProjects: () => Promise<void>
  createProject: (name: string, path: string) => Promise<Project>
  openProject: (id: string) => Promise<void>
  deleteProject: (id: string) => Promise<void>
}

export const useProjectStore = create<ProjectState>((set, get) => ({
  projects: [],
  activeProject: null,
  loading: true,

  loadProjects: async () => {
    const [projects, activeProject] = await Promise.all([
      window.electronAPI.project.list(),
      window.electronAPI.project.getActive()
    ])
    set({ projects, activeProject, loading: false })
  },

  createProject: async (name, path) => {
    const project = await window.electronAPI.project.create(name, path)
    set(state => ({
      projects: [...state.projects, project],
      activeProject: project
    }))
    return project
  },

  openProject: async (id) => {
    const project = await window.electronAPI.project.open(id)
    set({ activeProject: project })
  },

  deleteProject: async (id) => {
    await window.electronAPI.project.delete(id)
    set(state => ({
      projects: state.projects.filter(p => p.id !== id),
      activeProject: state.activeProject?.id === id ? null : state.activeProject
    }))
  }
}))
```

### Step 6: Create Sidebar Components (2h)
`src/renderer/components/sidebar/Sidebar.tsx`:
```tsx
import { useEffect } from 'react'
import { useProjectStore } from '../../stores/project-store'
import { ProjectList } from './ProjectList'
import { NewProjectButton } from './NewProjectButton'

export function Sidebar() {
  const { loadProjects, loading, activeProject } = useProjectStore()

  useEffect(() => {
    loadProjects()
  }, [])

  return (
    <aside className="w-64 bg-gray-800 flex flex-col h-full">
      <div className="p-4 border-b border-gray-700">
        <h1 className="text-xl font-bold text-white">MultiClaude</h1>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="p-2">
          <h2 className="text-xs uppercase text-gray-500 mb-2 px-2">Projects</h2>
          {loading ? (
            <div className="text-gray-500 px-2">Loading...</div>
          ) : (
            <ProjectList />
          )}
        </div>
      </div>

      <div className="p-4 border-t border-gray-700">
        <NewProjectButton />
      </div>
    </aside>
  )
}
```

`src/renderer/components/sidebar/ProjectList.tsx`:
```tsx
import { useProjectStore } from '../../stores/project-store'

export function ProjectList() {
  const { projects, activeProject, openProject, deleteProject } = useProjectStore()

  if (projects.length === 0) {
    return (
      <p className="text-gray-500 text-sm px-2">
        No projects yet. Create one below.
      </p>
    )
  }

  return (
    <ul className="space-y-1">
      {projects.map(project => (
        <li key={project.id}>
          <button
            onClick={() => openProject(project.id)}
            className={`w-full text-left px-3 py-2 rounded text-sm
              ${activeProject?.id === project.id
                ? 'bg-blue-600 text-white'
                : 'text-gray-300 hover:bg-gray-700'
              }`}
          >
            <div className="font-medium truncate">{project.name}</div>
            <div className="text-xs text-gray-400 truncate">{project.path}</div>
          </button>
        </li>
      ))}
    </ul>
  )
}
```

`src/renderer/components/sidebar/NewProjectButton.tsx`:
```tsx
import { useState } from 'react'
import { useProjectStore } from '../../stores/project-store'

export function NewProjectButton() {
  const [showForm, setShowForm] = useState(false)
  const [name, setName] = useState('')
  const [path, setPath] = useState('')
  const { createProject } = useProjectStore()

  async function handlePickDirectory() {
    const { path: selectedPath } = await window.electronAPI.project.pickDirectory()
    if (selectedPath) {
      setPath(selectedPath)
      // Auto-fill name from directory
      if (!name) {
        const dirName = selectedPath.split('/').pop() || 'New Project'
        setName(dirName)
      }
    }
  }

  async function handleCreate() {
    if (!name || !path) return
    await createProject(name, path)
    setShowForm(false)
    setName('')
    setPath('')
  }

  if (!showForm) {
    return (
      <button
        onClick={() => setShowForm(true)}
        className="w-full py-2 bg-blue-600 text-white rounded hover:bg-blue-500"
      >
        + New Project
      </button>
    )
  }

  return (
    <div className="space-y-2">
      <input
        type="text"
        placeholder="Project name"
        value={name}
        onChange={e => setName(e.target.value)}
        className="w-full px-3 py-2 bg-gray-700 rounded text-white text-sm"
      />
      <button
        onClick={handlePickDirectory}
        className="w-full py-2 bg-gray-700 rounded text-sm text-left px-3
                   text-gray-300 hover:bg-gray-600 truncate"
      >
        {path || 'Select directory...'}
      </button>
      <div className="flex gap-2">
        <button
          onClick={() => setShowForm(false)}
          className="flex-1 py-2 bg-gray-700 rounded text-sm"
        >
          Cancel
        </button>
        <button
          onClick={handleCreate}
          disabled={!name || !path}
          className="flex-1 py-2 bg-blue-600 rounded text-sm
                     disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Create
        </button>
      </div>
    </div>
  )
}
```

### Step 7: Integration (1h)
1. Update `App.tsx` to include Sidebar
2. Connect terminal creation to active project
3. Auto-load last active project on startup
4. Test project switching with terminals

## Success Criteria
- [ ] Create new project with directory picker
- [ ] Projects listed in sidebar
- [ ] Switch between projects (terminals update)
- [ ] Projects persist across app restart
- [ ] Last active project remembered
- [ ] Delete project works

## Risk Assessment
| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| electron-store schema migration | Low | Medium | Version schema, migrate on load |
| Directory permissions | Low | Low | Handle EACCES errors gracefully |
| Terminal state on project switch | Medium | Medium | Clear strategy: close all, open fresh |

## Deliverables
1. ProjectStore in main process
2. Project CRUD IPC handlers
3. Sidebar with project list
4. New project creation flow
5. Project switching with terminal integration
6. Ready for Phase 5 polish
