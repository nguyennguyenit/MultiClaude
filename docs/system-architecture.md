# MultiClaude System Architecture

## Overview

MultiClaude is an Electron desktop app with three layers:

- Main Process for PTY terminals, Git, project persistence, notifications, and updates
- Preload Bridge for the typed IPC surface exposed to the renderer
- Renderer Process for the React UI, Zustand state, and xterm.js terminal views

The terminal output path is intentionally split:

- `App.tsx` owns one shared `window.electron.terminal.onOutput(...)` subscription
- `terminal-output-dispatcher.ts` routes sequenced output by `terminalId`
- `TerminalView` handles xterm writes and visible-output buffering for its own terminal
- `terminal-output-buffer.ts` stores scrollback in a plain module, not reactive Zustand state

**Canonical terminal state:** The main process normally maintains one `@xterm/headless` terminal instance per PTY (with `SerializeAddon`). A per-terminal mutation queue commits every PTY chunk before main emits its monotonic sequence. Snapshots join that queue and return the matching `{streamEpoch, watermark}` barrier, so renderer hydration and buffered live output cannot overlap. Headless initialization is non-fatal: snapshot requests reject while the mirror is unavailable, and renderer hydration resumes the bounded sequenced live buffer instead of adopting an invalid empty epoch.

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
├── agent/                   # Provider adapters, managed-session registry, Codex App Server transport
├── agent-insights/          # Provider-neutral projections over normalized managed-agent events
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
│   ├── context-window/                   # Provider-neutral Agent Insights + Claude compatibility detail
│   │   ├── context-window-drawer.tsx     # Capability-driven shell; advanced work stays startup-gated
│   │   ├── agent-insights-summary.tsx    # Source/precision/confidence-aware Claude/Codex summary
│   │   ├── pane-switcher-header.tsx      # Per-pane row list (agent badge, ctx %, task-status dot)
│   │   ├── turn-injection-diff.tsx       # Per-turn delta with content-hash dedup, spike highlight
│   │   ├── execution-trace.tsx           # Flat tool activity; no inferred nested-agent joins
│   │   ├── compaction-timeline.tsx       # Explicit provider/transcript compaction boundaries
│   │   └── thinking-viewer.tsx           # Count/signature metadata without invented token volume
│   └── terminal/
│       ├── terminal-grid.tsx             # Multi-project host; renders pane trees
│       ├── pane-tree-node.tsx            # Recursive flex renderer + resize handles with rAF-coalesce
│       ├── split-button.tsx              # + / ▾ split action-bar control
│       ├── terminal-pane.tsx             # Pane chrome and restore wiring
│       ├── terminal-view.tsx             # xterm.js v6 host and handler registration
│       ├── terminal-output-handler.ts    # Chunk processing for visible output
│       ├── attachment-strip.tsx          # Horizontal thumbnail strip (80×60 tiles) below pane
│       └── attachment-remove-handler.ts  # Remove button logic: clears strip (Claude mode) or pops pending-media + backspace (non-Claude)
├── hooks/
│   ├── use-terminal-init.ts              # xterm init + snapshot fetch
│   ├── use-context-snapshot.ts           # Context analyzer real-time binding
│   ├── use-pane-resize.ts                # rAF-coalesced divider drag
│   └── [8 more sub-hooks]                # Modularized terminal hook refactor
├── stores/
│   ├── app-store.ts                      # Projects, terminals, UI state, buffer facade
│   ├── terminal-output-buffer.ts         # Non-reactive bounded restore buffer
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
  -> per-terminal main-process mutation queue
  -> headless terminal mirror commit (per-PTY @xterm/headless)
  -> monotonic {streamEpoch, sequence} IPC event (terminal:output)
  -> App.tsx shared listener
  -> terminal-output-dispatcher.ts
  -> epoch/sequence admission
  -> TerminalView handler
  -> xterm.write()
```

Current output handling is deliberately centralized:

- The main process writes every PTY byte into the per-PTY `@xterm/headless` terminal **before** emitting IPC. Each emitted chunk carries the terminal epoch and monotonic sequence.
- `App.tsx` attaches one shared listener with `attachTerminalOutputDispatcher(window.electron.terminal.onOutput)`
- `terminal-output-dispatcher.ts` keeps a `Map<terminalId, handler>` and forwards only to the matching terminal
- `TerminalView` registers and cleans up its handler with `registerTerminalOutputHandler(...)`
- The renderer applies only chunks in the active epoch whose sequence is newer than the committed snapshot watermark. A bounded gap queue requests resynchronization on gaps or overflow.

#### Headless Snapshot IPC Flow

On terminal mount (or remount after tab switch), `use-terminal-init.ts` invokes `terminal:get-snapshot` via the preload bridge. Main serializes the headless terminal only after an atomic queue barrier and returns ANSI plus epoch/watermark metadata. Renderer paints that snapshot, then flushes only newer buffered chunks in order.

When available, the headless terminal in main is the authoritative visual state: every PTY byte commits there before its IPC envelope is broadcast. If initialization or serialization fails, PTY output remains live and snapshot replay fails closed without resetting the visible terminal.

#### Warp-Style Refresh + System Resume

**Refresh button**: Triggers immediate `terminal:get-snapshot` fetch, writes into xterm viewport, restores scrollback state recorded by headless terminal.

**System resume**: When the system wakes from sleep, `powerMonitor` emits `resume` in the main process. A debounced handler (2000 ms window, 200 ms PTY-settle delay) sends `terminal:system-resumed` IPC to renderer lifecycle dispatcher, which triggers silent snapshot re-fetch and replay for all mounted terminals. This corrects display corruption caused by OS blanking the PTY on suspend.

**Alt-buffer caveat**: Interactive programs (vim, tmux, less, etc.) manage their own screen and repaint only when they receive keystroke/resize signal. After suspend/resume, those programs may appear blank until user interacts. Refresh button restores scrollback but cannot force repaint for alt-buffer programs.

Restore behavior:

- `TerminalPane` reads `initialOutput ?? useAppStore.getState().getTerminalOutput(terminalId)` as a first-resort; if empty, `use-terminal-init.ts` fetches a headless snapshot via IPC
- `skipAppendRef` suppresses duplicate appends during restore
- `addTerminal()` and `removeTerminal()` clear stale buffer entries for reused or closed terminal IDs

#### Legacy Raw Buffer (outputBuffer)

`PTYProcess.outputBuffer` is a bounded local restore/diagnostic tail. A separate bounded `notificationTail` serves explicitly enabled Telegram output and smart-summary commands. Neither is the normal UI source of truth; canonical refresh uses the headless snapshot, while renderer live buffering is the failure path when that snapshot is unavailable.

The startup-only `--legacy-terminal-stream` switch remains as the beta rollback escape hatch until real beta soak satisfies the removal gate. `terminal:rebuild-headless` is retained only for manual diagnostics; normal resize, refresh, and resume paths use the continuously maintained canonical mirror and do not invoke a rebuild.

### State Management

```text
Component action -> Zustand store -> persistence layer
```

Important current behavior:

- `useAppStore` manages terminal/project selection, layout state, and UI state
- Scrollback storage is not part of the reactive store tree anymore
- `appendOutput()` and `getTerminalOutput()` remain a bounded restore compatibility facade, not canonical terminal state
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
- `terminal:output` — broadcast sequenced PTY output after the canonical headless commit
- `terminal:exit` — PTY exit code + signal
- `terminal:title-change` — OSC escape sequence parsed title
- `terminal:get-snapshot` — invoke: return serialized headless state with `streamEpoch` and committed `watermark`
- `terminal:get-diagnostics` — invoke: return provider/engine/backend plus sequence/watermark and fallback metadata; never transcript content
- `terminal:rebuild-headless` — invoke: diagnostic-only rebuild from the bounded raw tail; never automatic on resize, refresh, or resume
- `terminal:system-resumed` — broadcast: trigger silent snapshot re-fetch for all mounted (debounced, 2s window)
- `terminal:load-pane-tree` / `terminal:save-pane-tree` — per-project split-tree IPC (schemaVersion 2 with on-read legacy flat → tree migration)

The renderer now uses `terminal:output` through the shared App-level subscription only. Individual terminal views no longer subscribe directly to IPC.

The legacy `terminal:show-context-menu` channel has been removed; right-click is handled by a themed React Portal menu reading CSS variables from the active theme.

### Managed Agent and Insights Channels

- `agent:get-readiness` / `agent:get-binding` — inspect provider availability and the caller-authorized terminal binding
- `agent:start` / `agent:resume` / `agent:send` / `agent:interrupt` / `agent:approve` — managed Claude/Codex lifecycle through `AgentRegistry`
- `agent:event` / `agent:binding-changed` / `agent:binding-removed` — normalized events targeted only to the owning renderer window
- `agent-insights:get` / `agent-insights:updated` — terminal-authorized, provider-neutral insight snapshots

`AgentRegistry` owns provider/session identity and terminal/project/window authorization. Renderer-supplied cwd, project IDs, or arbitrary session IDs are not authority. Claude and Codex projections declare capabilities independently; unavailable data remains unavailable rather than being coerced into another provider's schema.

The shipped terminal action bar exposes only **Start Claude**. Other CLIs, including Codex, are launched directly from the pane's shell; their managed renderer workflow remains capability-gated.

### Packaged Release Verification

The release matrix builds Linux, Windows, and macOS from the requested tag,
then launches the unpacked packaged executable through Playwright, creates and
destroys a real PTY, and verifies the exact-once snapshot shape. Linux runs the
smoke under Xvfb. The macOS release path uses Developer ID credentials and Apple
notarization credentials supplied by CI, skips the local ad-hoc compatibility
pass, and fails unless `codesign`, Gatekeeper assessment, and stapler validation
all succeed. Local `build:ci` artifacts remain explicitly ad-hoc signed.

### Claude Compatibility Context Channels

- `context:get` — invoke: return snapshot for sessionId (main: `ContextWindowAnalyzer.getSnapshot(sessionId)`) with 6-category breakdown plus optional `turnDeltas`, `compactionEvents`, `thinkingBlocks` (advanced flag)
- `context:snapshot` — broadcast: push real-time snapshot on 300ms debounce per session (main emits on state change). Hot payload p95 ≤ 64KB enforced by integration test
- `context:get-turn-detail` — invoke: cold-channel lookup of `TurnDeltaDetail` (per-item breakdown for one turn, fetched on row expand)
- `notification:pane-status-changed` — broadcast: per-terminal task lifecycle (`running|review|done|failed`) for the drawer's pane switcher header. Emitted from `notification-manager.handleTaskEvent` BEFORE notification settings/dedup gates so drawer reflects state regardless of user preferences

Claude compatibility detail remains available behind the projection boundary. Per-session modules owned by `ContextWindowAnalyzer` include:
- `TurnDeltaTracker` — per-turn token deltas with FNV-1a 64-bit content-hash dedup, FIFO 50
- `ExecutionTraceBuilder` — ordered flat tool activity; `Agent` calls are not presented as correlated nested executions
- `CompactionDetector` — explicit summary or provider boundary signals only; token drops and user-authored marker text do not synthesize events
- `ThinkingExtractor` — signature/count metadata only; opaque signatures do not imply token volume

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
