# MultiClaude System Architecture

## Overview

MultiClaude is an Electron application with a three-layer architecture: Main Process (Node.js), Renderer Process (React), and Preload Bridge (IPC).

## High-Level Architecture

```
+------------------+     IPC Bridge      +------------------+
|                  |<------------------->|                  |
|   Main Process   |   typed channels    |    Renderer      |
|    (Node.js)     |                     |    (React 19)    |
|                  |                     |                  |
+------------------+                     +------------------+
        |                                        |
        v                                        v
+------------------+                     +------------------+
|  Native Modules  |                     |   Zustand Store  |
|  - node-pty      |                     |   - AppStore     |
|  - electron-store|                     |   - Settings     |
|  - simple-git    |                     |   - Notification |
+------------------+                     +------------------+
```

## Process Architecture

### Main Process Modules

```
src/main/
├── index.ts                  # App entry, window creation, menu
├── terminal/
│   ├── terminal-manager.ts   # PTY lifecycle management
│   ├── wsl-detector.ts       # WSL detection (Windows)
│   └── index.ts
├── git/
│   ├── git-manager.ts        # Git operations via simple-git
│   ├── git-head-watcher.ts   # File watcher for HEAD changes
│   └── index.ts
├── project/
│   ├── project-store.ts      # electron-store persistence
│   └── index.ts
├── notification/
│   ├── notification-manager.ts  # Orchestrator
│   ├── pattern-detector.ts      # Regex matching
│   ├── secure-storage.ts        # Credential encryption
│   ├── telegram-notifier.ts     # Telegram Bot API
│   ├── discord-notifier.ts      # Discord Webhooks
│   └── index.ts
├── clipboard/
│   └── clipboard-handler.ts  # Image paste handling
├── updater/
│   ├── auto-updater.ts       # electron-updater wrapper
│   └── index.ts
└── ipc/
    ├── handlers.ts           # IPC handler registration
    ├── github-handlers.ts    # GitHub-specific handlers
    └── index.ts
```

### Renderer Architecture

```
src/renderer/
├── App.tsx                   # Root component, layout, handlers
├── main.tsx                  # React entry point
├── components/
│   ├── terminal/
│   │   ├── terminal-grid.tsx      # Auto-split grid layout
│   │   ├── terminal-pane.tsx      # Pane wrapper with header
│   │   ├── terminal-view.tsx      # xterm.js renderer
│   │   ├── terminal-action-bar.tsx
│   │   ├── shell-selector-dropdown.tsx  # WSL shell context menu
│   │   └── index.ts
│   ├── sidebar/
│   │   ├── sidebar.tsx            # Navigation + tools
│   │   ├── sidebar-header.tsx     # Logo + collapse toggle
│   │   ├── navigation-item.tsx    # Menu item component
│   │   ├── user-account-card.tsx  # GitHub account display
│   │   └── index.ts
│   ├── project-tabs/
│   │   ├── project-tabs.tsx       # Tab bar with shortcuts
│   │   └── index.ts
│   ├── settings/
│   │   ├── settings-modal.tsx     # Modal container
│   │   ├── settings-panel.tsx     # Tabbed settings
│   │   ├── settings-sidebar.tsx   # Settings navigation
│   │   ├── theme-selector.tsx     # Theme picker
│   │   ├── terminal-settings.tsx  # Terminal rendering modes
│   │   ├── notification-settings.tsx
│   │   ├── update-settings.tsx
│   │   ├── telegram-config-modal.tsx
│   │   ├── discord-config-modal.tsx
│   │   └── index.ts
│   ├── git-panel/
│   │   ├── git-panel.tsx          # Main git UI
│   │   ├── changes-list.tsx       # Staged/unstaged files
│   │   ├── commit-form.tsx        # Commit message input
│   │   ├── diff-viewer.tsx        # File diff display
│   │   ├── branch-selector.tsx    # Branch dropdown
│   │   ├── branches-tab.tsx       # Branch management
│   │   ├── history-tab.tsx        # Commit log
│   │   ├── stash-tab.tsx          # Stash operations
│   │   └── index.ts
│   ├── github-view/
│   │   ├── github-view.tsx        # Issues/PRs container
│   │   ├── github-action-bar.tsx  # Actions toolbar
│   │   ├── repo-info-header.tsx   # Repo metadata
│   │   ├── issues-tab.tsx         # Issue list
│   │   ├── prs-tab.tsx            # PR list
│   │   └── index.ts
│   ├── toast-container.tsx        # Toast notifications
│   └── welcome-screen.tsx         # First-run screen
├── hooks/
│   ├── use-keyboard-shortcuts.ts  # Global shortcuts
│   ├── use-file-drop.ts           # Drag-drop files
│   ├── use-terminal.ts            # Terminal state
│   ├── use-git-panel.ts           # Git panel state
│   └── index.ts
├── stores/
│   ├── app-store.ts               # Projects, terminals, UI state
│   ├── settings-store.ts          # Theme, terminal settings
│   ├── notification-store.ts      # Notification preferences
│   ├── update-store.ts            # Update state
│   ├── toast-store.ts             # Toast queue
│   └── index.ts
└── utils/
    ├── shell-utils.ts             # WindowsShell key helper
    ├── file-drop-handler.ts       # File drop processing
    └── index.ts
```

## Data Flow

### Terminal I/O Flow

```
+-------------+   input   +----------+   write   +---------+
| TerminalView| -------->| Preload  | -------->| PTY     |
| (xterm.js)  |          | (IPC)    |          | Process |
+-------------+          +----------+          +---------+
      ^                       |                     |
      |    output             |    data             |
      +---------------------- | <-------------------+
                              v
                     +------------------+
                     | PatternDetector  |
                     | (notifications)  |
                     +------------------+
```

### State Management Flow

```
+----------+    action    +-----------+    persist    +---------------+
| Component| ----------->| Zustand   | ------------->| localStorage  |
| (React)  |             | Store     |               | (settings)    |
+----------+             +-----------+               +---------------+
     ^                        |
     |     subscription       |
     +------------------------+

+----------+    IPC       +-----------+    persist    +---------------+
| Component| ----------->| Main      | ------------->| electron-store|
| (React)  |             | Process   |               | (projects)    |
+----------+             +-----------+               +---------------+
```

## IPC Channel Architecture

### Channel Categories (84 total)

| Category | Count | Purpose |
|----------|-------|---------|
| Terminal | 9 | PTY lifecycle, I/O, WSL detection |
| Project | 6 | CRUD, folder ops |
| Git | 35 | Full git workflow |
| GitHub | 5 | Auth, repo, issues/PRs |
| Session | 2 | Save/restore |
| App | 2 | Paths, updates |
| Notification | 12 | Settings, platforms |
| YOLO Mode | 2 | Feature toggle |
| Clipboard | 1 | Image handling |
| File Picker | 1 | Folder selection |
| Update | 5 | Auto-update system |
| Settings | 3 | App preferences persistence |

### IPC Type Safety

```typescript
// Preload bridge exposes typed API
interface ElectronAPI {
  terminal: {
    create: (options) => Promise<Terminal>
    destroy: (id: string) => Promise<void>
    input: (id: string, data: string) => void
    onOutput: (callback) => () => void
    detectWsl: () => Promise<WslInfo>  // Windows only
  }
  git: {
    status: (path: string) => Promise<GitStatus>
    commit: (path: string, message: string) => Promise<void>
    // ... 30+ methods
  }
  settings: {
    get: () => Promise<AppSettings>           // Get from electron-store
    set: (settings: Partial<AppSettings>) => Promise<AppSettings>
    reset: () => Promise<AppSettings>         // Reset to defaults
  }
  // ... other namespaces
}
```

## Terminal Grid Layout

Grid auto-adjusts based on terminal count:

```
1 terminal:     2 terminals:    3-4 terminals:
+----------+    +----+----+     +----+----+
|          |    |    |    |     |    |    |
|    1     |    | 1  | 2  |     | 1  | 2  |
|          |    |    |    |     +----+----+
+----------+    +----+----+     | 3  | 4  |
                                +----+----+

5-6 terminals:  7-9 terminals:  10-12 terminals:
+--+--+--+      +--+--+--+      +--+--+--+--+
| 1| 2| 3|      | 1| 2| 3|      | 1| 2| 3| 4|
+--+--+--+      +--+--+--+      +--+--+--+--+
| 4| 5| 6|      | 4| 5| 6|      | 5| 6| 7| 8|
+--+--+--+      +--+--+--+      +--+--+--+--+
                | 7| 8| 9|      | 9|10|11|12|
                +--+--+--+      +--+--+--+--+
```

**Implementation**: `react-resizable-panels` with nested PanelGroup/Panel components

## WebGL Rendering Modes

| Mode | Behavior | Use Case |
|------|----------|----------|
| Performance | No WebGL | Many terminals, low GPU |
| Balanced | WebGL on active only | Default, best of both |
| Quality | WebGL always enabled | Single terminal, best visuals |

**WebGL Disposal**: 150ms delay (`TERMINAL_DISPOSE_DELAY`) prevents display corruption during rapid project switching.

## Notification System

```
+---------------+     output     +------------------+
| TerminalMgr   | ------------->| PatternDetector  |
+---------------+               +------------------+
                                        |
                                        v
                                +------------------+
                                | NotificationMgr  |
                                +------------------+
                                   /    |    \
                                  v     v     v
                            Native  Telegram  Discord
```

**Pattern Detection**: Regex matching with 300ms debounce to prevent spam.

## Security Architecture

### Credential Storage
- **Telegram/Discord tokens**: Encrypted via `electron.safeStorage`
- **GitHub auth**: Delegated to `gh` CLI (no token storage)

### Context Isolation
- Renderer cannot access Node.js APIs directly
- All main process access through typed preload API
- IPC channels validated on both ends

## Build and Release

### Build Pipeline

```
Source (TypeScript)
        |
        v
+------------------+
| tsc (typecheck)  |
+------------------+
        |
        v
+------------------+
| Vite (bundle)    |
| - main process   |
| - renderer       |
| - preload        |
+------------------+
        |
        v
+------------------+
| electron-builder |
| - AppImage/deb   |
| - dmg/zip        |
| - nsis/portable  |
+------------------+
```

### Auto-Update Flow

```
App Start
    |
    v (3s delay)
Check GitHub Releases
    |
    +---> No update --> idle
    |
    v
Notify user (available)
    |
    v (user clicks Download)
Download with progress
    |
    v
Notify user (ready)
    |
    v (user clicks Install)
Quit and Install
```

## Performance Considerations

1. **WebGL per terminal**: Configurable to reduce GPU load
2. **Debounced fit**: ResizeObserver with 100ms debounce
3. **Lazy loading**: xterm addons loaded on demand
4. **IPC batching**: Terminal output buffered before send
5. **State selectors**: Zustand with shallow equality checks
6. **Smart scroll**: Auto-scroll only when at bottom; preserves position when reading scrollback

## Error Handling

| Layer | Strategy |
|-------|----------|
| Main Process | try/catch with logging, graceful degradation |
| IPC | Error objects serialized to renderer |
| Renderer | Error boundaries, toast notifications |
| Terminal | PTY exit codes surfaced to user |
