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

**Canonical terminal state:** The main process maintains one `@xterm/headless` terminal instance per PTY (with `SerializeAddon`). This headless mirror receives every byte the PTY emits and is the authoritative visual state source. The renderer fetches it via `terminal:get-snapshot` IPC invoke on mount.

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
│   ├── context-window/                   # Context analyzer drawer + extended sections (gated by enableContextWindowAdvanced)
│   │   ├── context-window-drawer.tsx     # Shell, mounts advanced sections behind flag
│   │   ├── pane-switcher-header.tsx      # Per-pane row list (agent badge, ctx %, task-status dot)
│   │   ├── turn-injection-diff.tsx       # Per-turn delta with content-hash dedup, spike highlight
│   │   ├── execution-trace.tsx           # Subagent + main-tool trace per turn (fallback mode)
│   │   ├── compaction-timeline.tsx       # Auto-compaction events (high/low confidence)
│   │   └── thinking-viewer.tsx           # Extended-thinking summary (signed-only in CLI v2.1+)
│   └── terminal/
│       ├── terminal-grid.tsx             # Multi-project host; renders pane trees
│       ├── pane-tree-node.tsx            # Recursive flex renderer + resize handles with rAF-coalesce
│       ├── split-button.tsx              # + / ▾ split action-bar control
│       ├── terminal-pane.tsx             # Pane chrome and restore wiring
│       ├── terminal-view.tsx             # xterm.js v6 host and handler registration
│       ├── terminal-output-handler.ts    # Chunk processing for visible output
│       ├── terminal-output-buffer.ts     # Non-reactive scrollback buffer module
│       ├── attachment-strip.tsx          # Horizontal thumbnail strip (80×60 tiles) below pane
│       └── attachment-remove-handler.ts  # Remove button logic: clears strip (Claude mode) or pops pending-media + backspace (non-Claude)
├── hooks/
│   ├── use-terminal-init.ts              # xterm init + snapshot fetch
│   ├── use-context-snapshot.ts           # Context analyzer real-time binding
│   ├── use-pane-resize.ts                # rAF-coalesced divider drag
│   └── [8 more sub-hooks]                # Modularized terminal hook refactor
├── stores/
│   ├── app-store.ts                      # Projects, terminals, UI state, buffer facade
│   ├── context-menu-store.ts             # Open/close state for themed context menu
│   ├── pane-tree-store.ts                # Per-project pane trees, debounced IPC persist
│   ├── image-store.ts                    # Per-terminal image/video entries with removeImage() method
│   ├── settings-store.ts                 # Pending/saved settings flow
│   ├── notification-store.ts             # Notification settings state
│   ├── update-store.ts                   # Update state
│   └── toast-store.ts                    # Toast queue
└── utils/
    ├── terminal-output-dispatcher.ts     # Shared output routing registry
    ├── terminal-scroll-machine.ts        # Pure scroll state (zero React, zero xterm)
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
  -> headless terminal mirror (main process, per-PTY @xterm/headless)
  -> main-process IPC event (terminal:output)
  -> App.tsx shared listener
  -> terminal-output-dispatcher.ts
  -> TerminalView handler
  -> xterm.write()
  -> visible-output append (skipAppendRef guard prevents restore duplicates)
  -> terminal-output-buffer.ts (transition cache only)
```

Current output handling is deliberately centralized:

- The main process writes every PTY byte into the per-PTY `@xterm/headless` terminal **before** emitting IPC. This headless instance (with `SerializeAddon`) is the canonical visual state.
- `App.tsx` attaches one shared listener with `attachTerminalOutputDispatcher(window.electron.terminal.onOutput)`
- `terminal-output-dispatcher.ts` keeps a `Map<terminalId, handler>` and forwards only to the matching terminal
- `TerminalView` registers and cleans up its handler with `registerTerminalOutputHandler(...)`
- `processTerminalOutputChunk()` writes the chunk into xterm, triggers `onOutput`, and appends only the visible data
- `terminal-output-buffer.ts` is a **transition cache** for the <100ms window before a headless snapshot arrives; it is not the source of truth

#### Headless Snapshot IPC Flow

On terminal mount (or remount after tab switch), `use-terminal-init.ts` invokes `terminal:get-snapshot` via the preload bridge. The main process serializes the headless terminal to a string (via `SerializeAddon`) and returns it. The renderer writes it into xterm as the initial view state. The renderer-side `terminal-output-buffer.ts` is only checked if no `initialOutput` prop is provided AND the snapshot has not arrived yet.

The headless terminal in the main process is the authoritative visual state: every PTY byte writes to headless first, then broadcasts IPC. This eliminates render-order races and enables warp-style refresh.

#### Warp-Style Refresh + System Resume

**Refresh button**: Triggers immediate `terminal:get-snapshot` fetch, writes into xterm viewport, restores scrollback state recorded by headless terminal.

**System resume**: When the system wakes from sleep, `powerMonitor` emits `resume` in the main process. A debounced handler (2000 ms window, 200 ms PTY-settle delay) sends `terminal:system-resumed` IPC to renderer lifecycle dispatcher, which triggers silent snapshot re-fetch and replay for all mounted terminals. This corrects display corruption caused by OS blanking the PTY on suspend.

**Alt-buffer caveat**: Interactive programs (vim, tmux, less, etc.) manage their own screen and repaint only when they receive keystroke/resize signal. After suspend/resume, those programs may appear blank until user interacts. Refresh button restores scrollback but cannot force repaint for alt-buffer programs.

Restore behavior:

- `TerminalPane` reads `initialOutput ?? useAppStore.getState().getTerminalOutput(terminalId)` as a first-resort; if empty, `use-terminal-init.ts` fetches a headless snapshot via IPC
- `skipAppendRef` suppresses duplicate appends during restore
- `addTerminal()` and `removeTerminal()` clear stale buffer entries for reused or closed terminal IDs

#### Legacy Raw Buffer (outputBuffer)

`PTYProcess.outputBuffer` in the main process accumulates raw ANSI bytes for **Telegram notifications only** (text extraction for `/output` and smart-summary commands). It is not used for UI rendering. The visual source of truth is the headless terminal snapshot. This buffer must not be expanded for new UI use-cases.

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

- `terminal:create` — spawn new PTY + headless mirror
- `terminal:destroy` — kill PTY, clean up headless, clear output buffer
- `terminal:input` — write to PTY stdin
- `terminal:resize` — SIGWINCH to PTY
- `terminal:list` — enumerate active terminals
- `terminal:invoke-claude` — spawn Claude session
- `terminal:detect-wsl` — detect WSL distros on Windows
- `terminal:output` — broadcast PTY output (after headless write)
- `terminal:exit` — PTY exit code + signal
- `terminal:title-change` — OSC escape sequence parsed title
- `terminal:get-snapshot` — invoke: return serialized headless state string (SerializeAddon) or `null`
- `terminal:system-resumed` — broadcast: trigger silent snapshot re-fetch for all mounted (debounced, 2s window)
- `terminal:load-pane-tree` / `terminal:save-pane-tree` — per-project split-tree IPC (schemaVersion 2 with on-read legacy flat → tree migration)

The renderer now uses `terminal:output` through the shared App-level subscription only. Individual terminal views no longer subscribe directly to IPC.

The legacy `terminal:show-context-menu` channel has been removed; right-click is handled by a themed React Portal menu reading CSS variables from the active theme.

### Context Window Channel

- `context:get` — invoke: return snapshot for sessionId (main: `ContextWindowAnalyzer.getSnapshot(sessionId)`) with 6-category breakdown plus optional `turnDeltas`, `compactionEvents`, `thinkingBlocks` (advanced flag)
- `context:snapshot` — broadcast: push real-time snapshot on 300ms debounce per session (main emits on state change). Hot payload p95 ≤ 64KB enforced by integration test
- `context:get-turn-detail` — invoke: cold-channel lookup of `TurnDeltaDetail` (per-item breakdown for one turn, fetched on row expand)
- `notification:pane-status-changed` — broadcast: per-terminal task lifecycle (`running|review|done|failed`) for the drawer's pane switcher header. Emitted from `notification-manager.handleTaskEvent` BEFORE notification settings/dedup gates so drawer reflects state regardless of user preferences

Per-session main-side modules (one instance each, owned by `ContextWindowAnalyzer`):
- `TurnDeltaTracker` — per-turn token deltas with FNV-1a 64-bit content-hash dedup, FIFO 50
- `ExecutionTraceBuilder` — fallback-mode tree (1 main node + N subagent nodes), tool_use_id keyed
- `CompactionDetector` — explicit summary markers (high) + >30% sudden-drop heuristic (low), 2s dedup, /clear-suppression, FIFO 10
- `ThinkingExtractor` — signature-only thinking block aggregation per turn, FIFO 30

### Media Channel

- `media:read-data-url` — Renderer requests a size-capped base64 data URL for an image/video file. Main process uses Electron `nativeImage.createFromPath().resize()` to resize to 80×60px; returns data URL or `null` on error (e.g., unsupported format, file deleted). Includes SVG fallback for missing thumbnails.

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
