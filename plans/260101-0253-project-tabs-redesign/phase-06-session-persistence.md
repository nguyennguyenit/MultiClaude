# Phase 6: Session Persistence

## Objective
Save and restore per-project terminal layouts between sessions.

## Files to Modify

### 1. Modify `src/main/project/project-store.ts`

Add terminal layout persistence:

```typescript
import Store from 'electron-store'
import type { Project, ProjectTerminalLayout } from '@shared/types'

interface ProjectStoreData {
  projects: Project[]
  terminalLayouts: Record<string, ProjectTerminalLayout>
  lastActiveProjectId: string | null
}

const store = new Store<ProjectStoreData>({
  name: 'projects',
  defaults: {
    projects: [],
    terminalLayouts: {},
    lastActiveProjectId: null
  }
})

export const projectStore = {
  // Existing methods
  list(): Project[] {
    return store.get('projects', [])
  },

  create(data: { name: string; path: string }): Project {
    const project: Project = {
      id: `proj-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      name: data.name,
      path: data.path,
      createdAt: new Date(),
      updatedAt: new Date()
    }
    const projects = this.list()
    projects.push(project)
    store.set('projects', projects)
    return project
  },

  delete(id: string): boolean {
    const projects = this.list().filter(p => p.id !== id)
    store.set('projects', projects)
    // Also delete terminal layout
    this.deleteTerminalLayout(id)
    return true
  },

  // Terminal layout methods
  getTerminalLayout(projectId: string): ProjectTerminalLayout | null {
    const layouts = store.get('terminalLayouts', {})
    return layouts[projectId] || null
  },

  setTerminalLayout(projectId: string, layout: ProjectTerminalLayout): void {
    const layouts = store.get('terminalLayouts', {})
    layouts[projectId] = layout
    store.set('terminalLayouts', layouts)
  },

  deleteTerminalLayout(projectId: string): void {
    const layouts = store.get('terminalLayouts', {})
    delete layouts[projectId]
    store.set('terminalLayouts', layouts)
  },

  getAllTerminalLayouts(): Record<string, ProjectTerminalLayout> {
    return store.get('terminalLayouts', {})
  },

  // Last active project
  getLastActiveProjectId(): string | null {
    return store.get('lastActiveProjectId', null)
  },

  setLastActiveProjectId(id: string | null): void {
    store.set('lastActiveProjectId', id)
  }
}
```

### 2. Modify `src/main/ipc/handlers.ts`

Add IPC handlers for terminal layouts:

```typescript
// Add to existing handlers
ipcMain.handle('project:getTerminalLayout', async (_, projectId: string) => {
  return projectStore.getTerminalLayout(projectId)
})

ipcMain.handle('project:setTerminalLayout', async (_, projectId: string, layout: ProjectTerminalLayout) => {
  projectStore.setTerminalLayout(projectId, layout)
  return true
})

ipcMain.handle('project:getAllTerminalLayouts', async () => {
  return projectStore.getAllTerminalLayouts()
})

ipcMain.handle('project:getLastActiveProjectId', async () => {
  return projectStore.getLastActiveProjectId()
})

ipcMain.handle('project:setLastActiveProjectId', async (_, id: string | null) => {
  projectStore.setLastActiveProjectId(id)
  return true
})
```

### 3. Modify `src/preload/index.ts`

Add to electron bridge:

```typescript
// Add to window.electron.project
project: {
  // ...existing
  getTerminalLayout: (projectId: string) =>
    ipcRenderer.invoke('project:getTerminalLayout', projectId),
  setTerminalLayout: (projectId: string, layout: ProjectTerminalLayout) =>
    ipcRenderer.invoke('project:setTerminalLayout', projectId, layout),
  getAllTerminalLayouts: () =>
    ipcRenderer.invoke('project:getAllTerminalLayouts'),
  getLastActiveProjectId: () =>
    ipcRenderer.invoke('project:getLastActiveProjectId'),
  setLastActiveProjectId: (id: string | null) =>
    ipcRenderer.invoke('project:setLastActiveProjectId', id)
}
```

### 4. Update `src/renderer/App.tsx`

Add session restore and save:

```typescript
// Add to init effect
useEffect(() => {
  const init = async () => {
    // Load projects
    const projects = await window.electron.project.list()
    setProjects(projects)

    // Load terminal layouts
    const layouts = await window.electron.project.getAllTerminalLayouts()
    for (const [projectId, layout] of Object.entries(layouts)) {
      useAppStore.getState().setProjectTerminalLayout(projectId, layout)
    }

    // Restore last active project
    const lastActiveId = await window.electron.project.getLastActiveProjectId()
    if (lastActiveId && projects.find(p => p.id === lastActiveId)) {
      setActiveProject(lastActiveId)

      // Restore terminals for active project
      const layout = layouts[lastActiveId]
      if (layout) {
        for (const t of layout.terminals) {
          const activeProject = projects.find(p => p.id === lastActiveId)
          if (activeProject) {
            const terminal = await window.electron.terminal.create({
              cwd: activeProject.path,
              projectId: lastActiveId
            })
            addTerminal(terminal)
          }
        }
      }
    }
  }
  init()
}, [])

// Add save on project change
useEffect(() => {
  if (activeProjectId) {
    window.electron.project.setLastActiveProjectId(activeProjectId)
  }
}, [activeProjectId])

// Add save terminal layout on change
useEffect(() => {
  const layout = projectTerminals[activeProjectId || '']
  if (activeProjectId && layout) {
    window.electron.project.setTerminalLayout(activeProjectId, layout)
  }
}, [activeProjectId, projectTerminals])
```

## Data Persistence Structure

```typescript
// electron-store data
{
  projects: [
    { id: "proj-1", name: "MyApp", path: "/home/user/myapp", ... }
  ],
  terminalLayouts: {
    "proj-1": {
      projectId: "proj-1",
      terminals: [
        { id: "term-1", title: "Terminal 1", position: 0 },
        { id: "term-2", title: "Claude", position: 1 }
      ]
    }
  },
  lastActiveProjectId: "proj-1"
}
```

## Session Restore Flow

```
App Start
    ↓
Load Projects
    ↓
Load Terminal Layouts
    ↓
Get Last Active Project ID
    ↓
If valid → Set Active Project
    ↓
Restore Terminals from Layout
    ↓
Ready
```

## Session Save Flow

```
Project Switch / Terminal Change
    ↓
Save Terminal Layout
    ↓
Save Last Active Project ID
    ↓
Done
```

## Validation

After implementation:
1. Close app with terminals open
2. Reopen app → same terminals restored
3. Switch projects → layout saved
4. Delete project → layout deleted
5. Last active project restored on startup
