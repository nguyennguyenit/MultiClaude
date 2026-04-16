# MultiClaude System Architecture

## Overview

MultiClaude is an Electron desktop app with three layers:

- Main Process for PTY terminals, Git, project persistence, notifications, and updates
- Preload Bridge for the typed IPC surface exposed to the renderer
- Renderer Process for the React UI, Zustand state, and xterm.js terminal views

The current terminal output path is intentionally split:

- `App.tsx` owns one shared `window.electron.terminal.onOutput(...)` subscription
- `terminal-output-dispatcher.ts` routes raw output by `terminalId`
- `TerminalView` handles xterm writes and visible-output buffering for its own terminal
- `terminal-output-buffer.ts` stores scrollback in a plain module, not reactive Zustand state

## High-Level Architecture

```text
+------------------+     IPC Bridge      +------------------+
|  Main Process    |<------------------->|   Renderer       |
|  Node.js + PTY   |   typed channels    |   React 19       |
|  Git + storage   |                     |   Zustand stores |
+------------------+                     +------------------+
        |                                        |
        v                                        v
 Native modules                           Terminal UI + state
```

## Process Architecture

### Main Process Modules

```text
src/main/
├── index.ts                 # App bootstrap, window creation, IPC registration
├── terminal/                # PTY lifecycle, suspend/resume, shell detection, OSC parsing
├── project/                 # Project persistence, session restore, WSL UNC path conversion
├── git/                     # Git operations and branch watchers
├── notification/            # Notification orchestration and credential storage
├── clipboard/               # Image paste handling
├── updater/                 # Auto-update wrapper
├── vietnamese-ime-patcher/  # Claude CLI IME patching
└── ipc/                     # IPC handler registration
```

### Renderer Architecture

```text
src/renderer/
├── App.tsx                               # Root component and shared terminal-output listener
├── components/
│   ├── context-menu/                     # Themed Portal context menu (theme-aware via CSS vars)
│   └── terminal/
│       ├── terminal-grid.tsx             # Multi-project host; renders pane trees
│       ├── pane-tree-node.tsx            # Recursive flex renderer + resize handles
│       ├── split-button.tsx              # + / ▾ split action-bar control
│       ├── terminal-pane.tsx             # Pane chrome and restore wiring
│       ├── terminal-view.tsx             # xterm.js host and handler registration
│       ├── terminal-output-handler.ts    # Chunk processing for visible output
│       └── terminal-output-buffer.ts     # Non-reactive scrollback buffer module
├── stores/
│   ├── app-store.ts                      # Projects, terminals, UI state, buffer facade
│   ├── context-menu-store.ts             # Open/close state for themed context menu
│   ├── pane-tree-store.ts                # Per-project pane trees, debounced IPC persist
│   ├── settings-store.ts                 # Pending/saved settings flow
│   ├── notification-store.ts             # Notification settings state
│   ├── update-store.ts                   # Update state
│   └── toast-store.ts                    # Toast queue
└── utils/
    ├── terminal-output-dispatcher.ts     # Shared output routing registry
    ├── paste-from-clipboard.ts           # Shared image + text paste pipeline
    └── pane-tree-reconcile.ts            # Tree <-> terminal list reconciliation
```

### Shared Code

- `src/shared/types/` defines terminal, project, settings, and notification types
- `src/shared/constants/` defines IPC channels, buffer trim thresholds, themes, and terminal limits

## Data Flow

### Terminal Input

```text
TerminalView -> preload bridge -> IPC send -> PTY process
```

Input still follows the usual Electron path:

1. `TerminalView` captures keyboard and paste activity
2. `window.electron.terminal.input(...)` writes to the main-process PTY
3. The main process forwards the input to the underlying shell

### Terminal Output

```text
PTY output
  -> main-process IPC event
  -> App.tsx shared listener
  -> terminal-output-dispatcher.ts
  -> TerminalView handler
  -> xterm.write()
  -> visible-output append
  -> terminal-output-buffer.ts
```

Current output handling is deliberately centralized:

- The main process still emits raw `terminal:output` IPC events
- `App.tsx` attaches one shared listener with `attachTerminalOutputDispatcher(window.electron.terminal.onOutput)`
- `terminal-output-dispatcher.ts` keeps a `Map<terminalId, handler>` and forwards only to the matching terminal
- `TerminalView` registers and cleans up its handler with `registerTerminalOutputHandler(...)`
- `processTerminalOutputChunk()` writes the chunk into xterm, triggers `onOutput`, and appends only the visible data
- `terminal-output-buffer.ts` stores scrollback in a plain `Map`, so output accumulation does not create reactive Zustand churn

Restore behavior remains unchanged:

- `TerminalPane` reads `initialOutput ?? useAppStore.getState().getTerminalOutput(terminalId)`
- `skipAppendRef` suppresses duplicate appends during restore
- `addTerminal()` and `removeTerminal()` clear stale buffer entries for reused or closed terminal IDs

### State Management

```text
Component action -> Zustand store -> persistence layer
```

Important current behavior:

- `useAppStore` manages terminal/project selection, layout state, and UI state
- Scrollback storage is not part of the reactive store tree anymore
- `appendOutput()` and `getTerminalOutput()` remain on the store API as a compatibility facade
- Settings use a pending/saved split so changes can preview before they are persisted

## IPC Channel Architecture

### Terminal Surface

- `terminal:create`
- `terminal:destroy`
- `terminal:input`
- `terminal:resize`
- `terminal:list`
- `terminal:invoke-claude`
- `terminal:detect-wsl`
- `terminal:output`
- `terminal:exit`
- `terminal:title-change`
- `terminal:load-pane-tree` / `terminal:save-pane-tree` — per-project split-tree persistence (schemaVersion 2 with on-read migration from the legacy flat layout)

The renderer now uses `terminal:output` through the shared App-level subscription only. Individual terminal views no longer subscribe directly to IPC.

The legacy `terminal:show-context-menu` channel has been removed; right-click is handled by a themed React Portal menu reading CSS variables from the active theme.

### Other Channel Families

- Project CRUD and folder validation
- Git status, staging, branching, history, stash, and watch events
- GitHub auth and repo views
- Notifications and active-terminal focus tracking
- Settings load/save/reset
- Update state polling and download/install flow
- Clipboard, file picker, YOLO mode, session, and window control helpers

## Security Architecture

- `contextIsolation` stays enabled
- `nodeIntegration` stays disabled in the renderer
- The preload script exposes a typed bridge with narrow IPC methods
- Sensitive credentials are stored through `electron.safeStorage`
- Main-process validation still owns settings and filesystem checks

## Performance Notes

The current architecture keeps the hot path small:

- Terminal grids stay mounted per project and are hidden instead of unmounted
- The output buffer is plain module state, not reactive store state
- One shared IPC listener replaces N per-terminal output subscriptions
- `TerminalView` owns xterm write timing, scrollback restore, and visible-data bookkeeping
- Terminal limits and WebGL rendering modes still cap resource usage

## Build And Release

- Development: Vite + Electron dev server
- Packaging: Electron Builder
- Updates: `electron-updater` with GitHub Releases

## Related Docs

- [Codebase Summary](./codebase-summary.md)
- [Project Overview & PDR](./project-overview-pdr.md)
- [Tech Stack](./tech-stack.md)
