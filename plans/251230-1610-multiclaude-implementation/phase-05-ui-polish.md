---
title: "Phase 5: UI Polish & Session Persistence"
status: pending
priority: P3
effort: 4h
---

# Phase 5: UI Polish & Session Persistence

> Context: [plan.md](./plan.md) | [Phase 4](./phase-04-project-management.md)

## Overview
| Field | Value |
|-------|-------|
| Date | 2025-12-30 |
| Priority | P3 - Nice to Have |
| Status | Pending |
| Effort | 4h |

## Objective
Polish UI, implement session persistence, and add finishing touches.

## Requirements
- R1: Save terminal state when closing app
- R2: Restore terminals on app restart
- R3: Keyboard shortcuts for common actions
- R4: Loading states and error handling
- R5: Responsive terminal grid
- R6: App icon and window title

## Architecture

### Session Data Model
```typescript
interface TerminalSession {
  id: string
  projectId: string
  cols: number
  rows: number
  scrollback?: string  // Last N lines (optional, can be large)
}

interface AppSession {
  activeProjectId: string | null
  terminals: TerminalSession[]
  windowBounds: { x: number; y: number; width: number; height: number }
}
```

### Persistence Strategy
- Save session on `before-quit` event
- Load session on app ready
- Don't persist scrollback (too large, stale data)
- Just restore terminal count and positions

## Implementation Steps

### Step 1: Create Session Manager (1.5h)
`src/main/session/session-manager.ts`:
```typescript
import Store from 'electron-store'
import { BrowserWindow } from 'electron'

interface TerminalSession {
  projectPath: string
}

interface AppSession {
  activeProjectId: string | null
  terminals: TerminalSession[]
  windowBounds: {
    x: number
    y: number
    width: number
    height: number
  } | null
}

const store = new Store<{ session: AppSession }>({
  name: 'session',
  defaults: {
    session: {
      activeProjectId: null,
      terminals: [],
      windowBounds: null
    }
  }
})

export class SessionManager {
  saveSession(
    activeProjectId: string | null,
    terminals: Array<{ projectPath: string }>,
    window: BrowserWindow
  ): void {
    const bounds = window.getBounds()

    store.set('session', {
      activeProjectId,
      terminals: terminals.map(t => ({ projectPath: t.projectPath })),
      windowBounds: bounds
    })
  }

  loadSession(): AppSession {
    return store.get('session')
  }

  getWindowBounds(): AppSession['windowBounds'] {
    return store.get('session.windowBounds')
  }
}

export const sessionManager = new SessionManager()
```

### Step 2: Integrate Session Save/Restore (1h)
Update `src/main/index.ts`:
```typescript
import { sessionManager } from './session/session-manager'
import { terminalManager } from './terminal/terminal-manager'
import { projectStore } from './project/project-store'

// On app quit
app.on('before-quit', () => {
  const activeProject = projectStore.getActive()
  const terminals = terminalManager.getAllWithInfo()

  if (mainWindow) {
    sessionManager.saveSession(
      activeProject?.id || null,
      terminals,
      mainWindow
    )
  }
})

// On app ready - restore
app.whenReady().then(() => {
  const session = sessionManager.loadSession()

  // Restore window bounds
  const bounds = session.windowBounds
  const windowOptions = {
    width: bounds?.width || 1400,
    height: bounds?.height || 900,
    x: bounds?.x,
    y: bounds?.y,
    // ... other options
  }

  createWindow(windowOptions)

  // Restore terminals after window created
  if (session.terminals.length > 0) {
    session.terminals.forEach(t => {
      terminalManager.create(t.projectPath)
    })
  }
})
```

### Step 3: Add Keyboard Shortcuts (30m)
`src/main/shortcuts.ts`:
```typescript
import { globalShortcut, BrowserWindow } from 'electron'

export function registerShortcuts(window: BrowserWindow) {
  // Cmd/Ctrl + T: New terminal
  globalShortcut.register('CommandOrControl+T', () => {
    window.webContents.send('shortcut:new-terminal')
  })

  // Cmd/Ctrl + W: Close current terminal
  globalShortcut.register('CommandOrControl+W', () => {
    window.webContents.send('shortcut:close-terminal')
  })

  // Cmd/Ctrl + 1-4: Focus terminal
  for (let i = 1; i <= 4; i++) {
    globalShortcut.register(`CommandOrControl+${i}`, () => {
      window.webContents.send('shortcut:focus-terminal', { index: i - 1 })
    })
  }

  // Cmd/Ctrl + N: New project
  globalShortcut.register('CommandOrControl+N', () => {
    window.webContents.send('shortcut:new-project')
  })
}

export function unregisterShortcuts() {
  globalShortcut.unregisterAll()
}
```

Handle shortcuts in renderer:
```typescript
// In terminal store or App.tsx
useEffect(() => {
  const unsubNewTerminal = window.electronAPI.on('shortcut:new-terminal', () => {
    addTerminal()
  })

  const unsubCloseTerminal = window.electronAPI.on('shortcut:close-terminal', () => {
    if (focusedTerminalId) {
      removeTerminal(focusedTerminalId)
    }
  })

  return () => {
    unsubNewTerminal()
    unsubCloseTerminal()
  }
}, [])
```

### Step 4: Add Loading & Error States (30m)
`src/renderer/components/ui/LoadingSpinner.tsx`:
```tsx
export function LoadingSpinner() {
  return (
    <div className="flex items-center justify-center h-full">
      <div className="animate-spin rounded-full h-8 w-8 border-2
                      border-gray-600 border-t-blue-500" />
    </div>
  )
}
```

`src/renderer/components/ui/ErrorBoundary.tsx`:
```tsx
import { Component, ReactNode } from 'react'

interface Props {
  children: ReactNode
  fallback?: ReactNode
}

interface State {
  hasError: boolean
  error?: Error
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback || (
        <div className="p-4 bg-red-900/20 text-red-400 rounded">
          <h3 className="font-bold">Something went wrong</h3>
          <p className="text-sm">{this.state.error?.message}</p>
        </div>
      )
    }
    return this.props.children
  }
}
```

### Step 5: Polish Terminal Grid (30m)
Update `TerminalGrid.tsx` for responsive layout:
```tsx
// Determine grid layout based on terminal count
function getGridClass(count: number): string {
  switch (count) {
    case 1: return 'grid-cols-1'
    case 2: return 'grid-cols-2'
    case 3: return 'grid-cols-2 grid-rows-2' // 2+1 layout
    case 4: return 'grid-cols-2 grid-rows-2'
    default: return 'grid-cols-1'
  }
}

// Add terminal focus indicator
<div
  className={`relative ${focused ? 'ring-2 ring-blue-500' : ''}`}
  onClick={() => setFocusedTerminalId(id)}
>
  <Terminal id={id} />
  <button
    onClick={() => removeTerminal(id)}
    className="absolute top-2 right-2 p-1 bg-gray-800/80 rounded
               opacity-0 hover:opacity-100 transition-opacity"
  >
    ×
  </button>
</div>
```

### Step 6: Window Title & Icon (30m)
Update `src/main/index.ts`:
```typescript
function createWindow(options: Partial<BrowserWindowConstructorOptions>) {
  const win = new BrowserWindow({
    ...options,
    title: 'MultiClaude',
    icon: path.join(__dirname, '../../assets/icon.png'),
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
    // ...
  })

  // Update title with active project
  ipcMain.on('project:active-changed', (_, { name }) => {
    win.setTitle(`MultiClaude - ${name}`)
  })
}
```

Create simple icon:
- `assets/icon.png` (256x256)
- `assets/icon.icns` (macOS)
- `assets/icon.ico` (Windows)

## Success Criteria
- [ ] Terminals restore after app restart
- [ ] Window position/size remembered
- [ ] Keyboard shortcuts work (Cmd+T, Cmd+W, Cmd+1-4)
- [ ] Loading spinners on async operations
- [ ] Error boundaries catch crashes
- [ ] Terminal grid responsive
- [ ] App has custom icon

## Risk Assessment
| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| Session restore fails | Low | Low | Fallback to empty state |
| Shortcuts conflict with terminal | Medium | Medium | Use less common combos |
| Icon format issues | Low | Low | Use electron-builder icons |

## Deliverables
1. Session persistence (terminals + window bounds)
2. Keyboard shortcuts
3. Loading/error UI components
4. Polished terminal grid
5. App icon and title
6. Production-ready MVP

## Post-MVP Enhancements (Not in Scope)
- Terminal themes (dracula, monokai, etc.)
- Terminal tabs instead of grid
- Split pane resizing
- Search in terminal output
- Export terminal output to file
