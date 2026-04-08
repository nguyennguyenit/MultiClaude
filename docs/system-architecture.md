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
├── index.ts                          # App entry, window creation, IPC registration
├── terminal/
│   ├── terminal-manager.ts           # PTY lifecycle, suspend/resume, output buffering, OSC parsing
│   ├── wsl-detector.ts               # WSL distro detection and validation
│   ├── shortcut-utils.ts             # Escape key leakage prevention
│   └── index.ts
├── settings/
│   ├── settings-store.ts             # electron-store with validation firewall for themes/limits/shells
│   └── __tests__/
├── git/
│   ├── git-manager.ts                # Git operations via simple-git
│   ├── git-head-watcher.ts           # File watcher for HEAD changes
│   └── index.ts
├── project/
│   ├── project-store.ts              # electron-store persistence + WSL UNC path conversion
│   └── index.ts
├── notification/
│   ├── notification-manager.ts       # Orchestrator for all notification types
│   ├── pattern-detector.ts           # Regex matching with debounce
│   ├── secure-storage.ts             # Electron safeStorage encryption
│   ├── telegram-notifier.ts          # Telegram Bot API
│   ├── discord-notifier.ts           # Discord Webhooks
│   └── index.ts
├── clipboard/
│   └── clipboard-handler.ts          # Image paste to temp file + path insertion
├── updater/
│   ├── auto-updater.ts               # electron-updater wrapper
│   └── index.ts
├── vietnamese-ime-patcher/
│   ├── vietnamese-ime-patcher.ts     # Auto-detect and patch Claude CLI
│   └── index.ts
└── ipc/
    ├── handlers.ts                   # Main IPC handler registration
    ├── github-handlers.ts            # GitHub OAuth/repo operations
    └── index.ts
```

### Renderer Architecture

```
src/renderer/
├── App.tsx                   # Root component, theme system, layout, handlers
├── main.tsx                  # React entry point
├── components/
│   ├── toolbar/              # Compact 32px header (VibeTerminal)
│   │   ├── toolbar.tsx            # Main toolbar container
│   │   ├── toolbar-button.tsx     # Reusable icon button
│   │   └── index.ts
│   ├── terminal/             # Terminal workspace
│   │   ├── terminal-grid.tsx      # Auto-flex grid layout (no resize handles)
│   │   ├── terminal-pane.tsx      # Pane with bottom tab bar + actions
│   │   ├── terminal-view.tsx      # xterm.js renderer
│   │   └── index.ts
│   ├── git-panel/            # Git panel components (single-column collapsible sections, conditionally mounted)
│   │   ├── git-panel.tsx          # Main container with performance optimization (conditional mount)
│   │   ├── changes-list.tsx       # File list with status indicators
│   │   ├── commit-form.tsx        # Commit message input + action buttons
│   │   ├── diff-viewer.tsx        # File diff display
│   │   ├── diff-modal.tsx         # Modal for viewing file diffs
│   │   ├── history-tab.tsx        # Commit log with details
│   │   ├── stash-tab.tsx          # Stash operations (save/apply/pop/drop)
│   │   ├── collapsible-section.tsx # Reusable header with collapse/expand toggle
│   │   ├── git-file-utils.ts      # Utilities: getStatusColor(), getStatusLabel(), groupByDir()
│   │   └── index.ts
│   ├── github-view/          # GitHub slide panel (right/bottom, single-column redesign)
│   │   ├── github-view.tsx        # Main view: CommitForm, StashTab, HistoryTab, Branch Comparison, Issues/PRs
│   │   ├── compact-header.tsx      # Branch selector + fetch/pull/push controls
│   │   ├── branch-diff-file-list.tsx  # Single-column scrollable diff file listing
│   │   ├── issues-tab.tsx         # Issue list
│   │   ├── prs-tab.tsx            # PR list
│   │   └── index.ts
│   ├── settings/             # Settings slide panel (right/bottom)
│   │   ├── settings-panel.tsx     # Tabbed settings container
│   │   ├── theme-selector.tsx     # VibeTheme picker (7 UI + 5 ANSI)
│   │   ├── terminal-settings.tsx  # Terminal rendering modes
│   │   ├── notification-settings.tsx  # Telegram/Discord config
│   │   ├── update-settings.tsx    # Update checker UI
│   │   ├── toggle-switch.tsx      # Reusable settings control (NEW)
│   │   ├── telegram-config-modal.tsx
│   │   ├── discord-config-modal.tsx
│   │   └── index.ts
│   ├── update-banner.tsx          # Visual update state component (NEW)
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
│   ├── settings-store.ts          # Theme, UI style, terminal settings
│   ├── notification-store.ts      # Notification preferences
│   ├── update-store.ts            # Update state
│   ├── toast-store.ts             # Toast queue
│   ├── image-store.ts             # Image handling and upload state
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

Terminal Lifecycle (Phase 1 - Single-Parent Pattern):
- ALL project grids render in single parent hierarchy
- Inactive projects: CSS display:none, WebGL disabled via hidden prop
- NO React unmount on project switch (prevents reconciliation)
- Preserves xterm.js cursor position, buffer, and WebGL context
- PTY continues running in background for all terminals

Viewport Scroll Position Preservation:
- **Save Phase** (Render): When terminal hidden via prop, synchronously captures buffer state
  - `savedViewportRef` stores: viewportY (current scroll line), baseY (total lines), isAtBottom flag
- **Hide Phase** (DOM): CSS display:none applied via TerminalPane hidden prop
- **Show Phase** (Fit): When terminal re-shown and fit() called
  - Calculates ratio: `savedRatio = savedViewportY / savedBaseY`
  - Restores proportional position: `newViewportY = round(savedRatio * newBaseY)`
  - Clamps to valid range to handle buffer growth/shrinkage
  - Restores isAtBottom to block smart-scroll during restore
- **Benefit**: Seamless terminal switching without scroll jump within same project
```

### State Management Flow

```
+----------+    action    +-----------+    persist    +---------------+
| Component| ----------->| Zustand   | ------------->| electron-store|
| (React)  |             | Store     |               | (settings)    |
+----------+             +-----------+               +---------------+
     ^                        |
     |  subscription/preview  |
     +------------------------+

Architecture: Save/Cancel Flow
- savedSettings: Disk source of truth (from electron-store)
- pendingSettings: Live preview (edited but not saved)
- Changes preview immediately, persist only on Save
- localStorage migration: One-time automatic on first load
- Validation: Main process validates all settings before persist
  - uiStyle: 'modern' | 'terminal'
  - terminalStyleOptions: colorPreset, fontFamily, useBorderChars

Terminal UI Style Integration (App.tsx):
- Imports TERMINAL_FONTS and TERMINAL_COLOR_PRESETS from @shared/constants
- Theme useEffect applies classes dynamically based on pendingSettings.uiStyle
- Granular reactivity: Flattened dependency array for terminalStyleOptions
- DRY principle: Derives preset classes from TERMINAL_COLOR_PRESETS object
- CSS class management: .ui-terminal, .terminal-preset-{id}, .use-border-chars
- CSS variable: --mc-terminal-font set dynamically from selected font

+----------+    IPC       +-----------+    persist    +---------------+
| Component| ----------->| Main      | ------------->| electron-store|
| (React)  |             | Process   |               | (projects)    |
+----------+             +-----------+               +---------------+
```

## IPC Channel Architecture

### Channel Categories (86 total)

| Category | Count | Purpose |
|----------|-------|---------|
| Terminal | 9 | PTY lifecycle, I/O, WSL detection |
| Project | 7 | CRUD, folder ops (WSL UNC path conversion) |
| Git | 38 | Full git workflow + branch comparison + conditional mount + concurrency guard |
| GitHub | 5 | Auth, repo, issues/PRs |
| Session | 2 | Save/restore |
| App | 2 | Paths, updates |
| Notification | 12 | Settings, platforms |
| YOLO Mode | 2 | Feature toggle |
| Clipboard | 1 | Image handling |
| File Picker | 1 | Folder selection |
| Update | 5 | Auto-update system |
| Settings | 3 | App preferences persistence |
| Window | 3 | Window controls |

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
    get: () => Promise<AppSettings>           // Get from electron-store with validation
    set: (settings: Partial<AppSettings>) => Promise<AppSettings>  // Save to disk with validation
    reset: () => Promise<AppSettings>         // Reset to defaults
  }
  image: {
    open: (filePath: string) => Promise<boolean>      // Open image in system viewer
    delete: (filePath: string) => Promise<boolean>    // Delete image file
    readBase64: (filePath: string) => Promise<string | null>  // Read as base64
  }
  // ... other namespaces
}
```

## Repository Tooling

### Release Automation

Release orchestration is repo-local tooling rather than app runtime code:

```text
.claude/skills/release/SKILL.md          # Claude Code native skill (/release)
scripts/release/
  release-command.mjs
  release-context.mjs
  execute-release.mjs
  git-state.mjs
  github-release.mjs
  release-notes.mjs
  resolve-target.mjs
  versioning.mjs
  write-version.mjs
```

Flow:

1. Claude Code skill `/release <target>` runs preview against repo state.
2. Preview resolves target branch, validates preflight state (auth, tag uniqueness, clean tree).
3. Skill prompts for missing release type (stable/prerelease) and version if needed.
4. Execute updates `package.json` / `package-lock.json`, creates the release commit and tag, creates a draft GitHub release, dispatches `.github/workflows/release.yml` via `workflow_dispatch` for the exact tag, and waits for the upload job to attach assets to that draft.
5. Publishing remains manual after CI uploads finish.

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

**WebGL Disposal**: 100ms delay (`TERMINAL_DISPOSE_DELAY`) prevents display corruption during rapid project switching.

**Git Panel Performance**: Conditional mount + shared concurrency guard prevent polling/status checks when panel closed, reducing memory/CPU usage by ~30%.

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

## Settings Architecture (v3.1.0)

### Dual-Layer Settings System

**Main Process (electron-store)**
```
SettingsStore (main process)
  └─ electron-store persistence
     └─ Validation firewall for themeMode, colorTheme, terminalLimit, windowsShell, etc.
```

**Renderer (Zustand)**
```
SettingsStore (Zustand)
  ├─ savedSettings (disk source of truth)
  ├─ pendingSettings (live preview)
  ├─ hasUnsavedChanges (deep field-by-field equality)
  └─ Save/Cancel buttons
     ├─ Save → IPC to main, persist to disk
     └─ Cancel → Reset pendingSettings to savedSettings
```

### Terminal Limits Feature
- **Presets**: 2, 4, 9, or custom (1-99)
- **Storage**: `terminalLimit: { preset: '2' | '4' | '9' | 'custom', customValue?: number }`
- **Enforcement**: TerminalGrid respects limit, prevents spawning beyond max
- **Per-Project**: Terminal count resets per project; layout respects limit

### System Suspend/Resume
- Main process listens for `system-suspend` / `system-resume` events
- Pauses PTY operations during system sleep to prevent SIGTRAP crashes
- Auto-resumes on wake with terminal health checks
- Renderer notified of resume for UI refresh if needed

## Performance Considerations

1. **Terminal Rendering**: Three modes (Performance/Balanced/Quality) with Claude-safe toggle
2. **Terminal Output Buffering**: TERMINAL_OUTPUT_BUFFER_MAX with intelligent trim on overflow
3. **OSC Parsing**: Accumulates escape sequences; updates terminal title on complete sequences
4. **Smart Scroll**: Auto-scroll only when at bottom; preserves position when reading scrollback
5. **IPC Batching**: Terminal output accumulated before IPC send
6. **State Selectors**: Zustand with shallow equality checks
7. **WebGL Disposal**: 100ms deferred cleanup on project switch prevents display corruption

## Error Handling

| Layer | Strategy |
|-------|----------|
| Main Process | try/catch with logging, graceful degradation |
| IPC | Error objects serialized to renderer |
| Renderer | Error boundaries, toast notifications |
| Terminal | PTY exit codes surfaced to user |
