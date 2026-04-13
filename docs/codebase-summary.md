# MultiClaude Codebase Summary

## Overview

MultiClaude is an Electron desktop app for running multiple Claude Code sessions in parallel. The repo centers on three concerns:

- terminal orchestration and output handling
- project/session persistence and layout restore
- desktop UI state, settings, and integrations

This snapshot reflects the current renderer output refactor:

- scrollback is stored in a non-reactive buffer module
- `App.tsx` owns one shared terminal output subscription
- output is routed through a small dispatcher into each mounted `TerminalView`

## Architecture

### Main Process

The main process handles OS-facing work and long-lived state:

- PTY lifecycle and shell detection
- project CRUD, session restore, and WSL UNC path conversion
- Git operations and HEAD watching
- notifications, credential storage, and task detection
- updater flow, clipboard image handling, and Vietnamese IME patching
- IPC handler registration

### Renderer Process

The renderer owns the React UI and local state:

- `App.tsx` composes the shell, panels, and shared listeners
- terminal UI lives under `src/renderer/components/terminal/`
- Zustand stores handle app state, settings, notifications, updates, toasts, and image state
- renderer utilities cover terminal output dispatching, file-drop handling, and shell/path helpers

### Shared Code

- `src/shared/types/` defines terminal, project, settings, notification, and shell types
- `src/shared/constants/` defines IPC channel names, buffer trim thresholds, themes, and terminal limits

## Terminal Subsystem

### Current Output Path

The current terminal output flow is intentionally centralized:

```text
PTY output
  -> main-process IPC event
  -> App.tsx shared listener
  -> terminal-output-dispatcher.ts
  -> TerminalView handler
  -> xterm.write()
  -> terminal-output-buffer.ts
```

Key pieces:

- `src/renderer/utils/terminal-output-dispatcher.ts` keeps a `Map<terminalId, handler>`
- `src/renderer/components/terminal/terminal-view.tsx` registers a handler for the terminal it owns
- `src/renderer/components/terminal/terminal-output-handler.ts` wraps `write()`, `onOutput`, and visible-output buffering
- `src/renderer/stores/terminal-output-buffer.ts` stores scrollback in a plain module-level `Map`
- `src/renderer/stores/app-store.ts` keeps the old facade methods so call sites still read and append output through the store API

Important behavior:

- output writes do not live in reactive Zustand state
- `TerminalPane` restores from `initialOutput ?? useAppStore.getState().getTerminalOutput(terminalId)`
- `addTerminal()` and `removeTerminal()` clear stale buffers for terminal reuse and cleanup
- `skipAppendRef` suppresses duplicate appends during restore

### Terminal UI Flow

- `TerminalGrid` keeps all project grids mounted and hides inactive ones
- `TerminalPane` provides tab chrome, restore wiring, and action buttons
- `TerminalView` owns xterm lifecycle, focus, refresh, scroll tracking, and output processing

This arrangement preserves terminal state across project switching without forcing unmount/remount churn.

## File Organization

```text
src/
├── main/
│   ├── terminal/
│   ├── project/
│   ├── git/
│   ├── notification/
│   ├── clipboard/
│   ├── updater/
│   ├── vietnamese-ime-patcher/
│   └── ipc/
├── renderer/
│   ├── App.tsx
│   ├── components/
│   │   ├── terminal/
│   │   ├── settings/
│   │   ├── github-view/
│   │   └── toolbar/
│   ├── hooks/
│   ├── stores/
│   └── utils/
├── preload/
└── shared/
```

Notable renderer files for the refactor:

- `src/renderer/stores/app-store.ts`
- `src/renderer/stores/terminal-output-buffer.ts`
- `src/renderer/utils/terminal-output-dispatcher.ts`
- `src/renderer/components/terminal/terminal-output-handler.ts`
- `src/renderer/components/terminal/terminal-view.tsx`
- `src/renderer/App.tsx`

## IPC Surface

### Terminal

- create, destroy, list, input, resize, invoke-claude, detect-wsl
- output, exit, and title-change events

### Project

- list, create, delete, set-active, open-folder, check-folder

### Git

- status, init, remote, push, branch, stash, diff, log, watch

### GitHub

- auth status, login/logout, repo creation, issues, and pull requests

### Notifications

- settings persistence, provider configuration, test actions, active-terminal focus

### Other

- settings get/set/reset
- session save/restore
- update state and install flow
- clipboard image save
- file picker
- YOLO mode toggle
- window controls

The preload bridge keeps these channels typed and isolated from the renderer.

## Key State Stores

### App Store

`src/renderer/stores/app-store.ts` manages:

- terminal list and active terminal selection
- project list and active project selection
- per-project last-active terminal tracking
- terminal keyboard enhancement state
- terminal layout snapshots

The output API remains as a compatibility facade:

- `getTerminalOutput(id)`
- `appendOutput(id, data)`

Those methods delegate to the plain terminal buffer module instead of storing output in Zustand.

### Settings Store

The settings store uses a pending/saved split:

- `pendingSettings` drives the live UI preview
- `savedSettings` is the persisted source of truth
- changes are applied in the renderer and committed on Save

### Other Stores

- `notification-store.ts` handles notification preferences and sound state
- `update-store.ts` tracks update state
- `toast-store.ts` queues UI toasts
- `image-store.ts` tracks pasted and detected images for terminal previews

## Dependencies

Core runtime dependencies include:

- Electron
- React
- TypeScript
- Vite
- `node-pty`
- `xterm.js`
- `electron-store`
- `simple-git`
- `electron-updater`
- `zustand`

## Development Workflow

Common local commands:

```bash
npm run electron:dev
npm run build
npm test
npm run typecheck
npm run lint
```

The repo also uses a local release command for GitHub release automation.

## Current Design Notes

- Single-parent terminal grids avoid unmount churn during project switching
- The renderer output path is no longer reactive and no longer fans out per terminal
- Settings still use validation before persistence in the main process
- Security depends on context isolation, a typed preload bridge, and safeStorage for secrets

## Related Docs

- [System Architecture](./system-architecture.md)
- [Project Overview & PDR](./project-overview-pdr.md)
- [Tech Stack](./tech-stack.md)
