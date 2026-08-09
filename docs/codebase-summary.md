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
- Each active group renders a `PaneTree` via `PaneTreeNode` — a recursive flex layout (tmux/iTerm-style binary split tree) replacing the legacy auto-grid
- `TerminalPane` provides tab chrome, restore wiring, and action buttons; also mounts `AttachmentStrip` above the pane
- `TerminalView` owns xterm lifecycle, focus, refresh, scroll tracking, and output processing
- `AttachmentStrip` renders 80×60px thumbnail tiles for dropped images/videos, with filename tooltip and ✕ remove button

This arrangement preserves terminal state across project switching without forcing unmount/remount churn.

### Pane Tree Layout

- Pure model in `src/shared/types/pane-tree.ts` + ops in `src/shared/utils/pane-tree.ts` (`splitLeaf`, `closeLeafAndCollapse`, `updateRatio`, …). `updateRatio` returns the tree unchanged on stale paths (defense-in-depth for drag listeners that outlive tree restructuring).
- Per-project tree persisted in `electron-store` under `terminalLayouts[projectId].paneTree` with `schemaVersion: 2`. Legacy flat layouts migrate on first read via `migrateFlatToTree` (`pane-tree-migration.ts`) preserving the pre-upgrade visual arrangement for N=1–12 terminals in both orientations. Migration is per-process single-flight; `savePaneTree` refuses to downgrade a future `schemaVersion`; validator caps recursion at depth 32.
- Renderer store `pane-tree-store.ts` debounces writes (200ms) via `terminal:load-pane-tree` / `terminal:save-pane-tree` IPC. Save rejections surface via `console.error` with projectId context rather than silently swallowing.
- Split actions (`right` / `left` / `down` / `up`) dispatched from three entry points — right-click menu, hotkeys (⌘⇧→/←/↓/↑), action-bar split-button — all funnel through `useExecuteSplit`. Close routes flow through `closeLeafAndCollapse` so parent splits collapse when a sibling is removed. `useExecuteSplit` wraps `terminal:create` in a 10 s `CREATE_TIMEOUT_MS` race and, on timeout, fires a toast + destroys any late-arriving orphan PTY. In-flight counter guards concurrent hotkey presses from exceeding the limit.
- Resize uses `usePaneResize` + `ResizeHandle`: pointer capture on the handle itself (no global window listeners), cleanup ref tears down on unmount mid-drag, rect is re-read on each move (window resize tolerance), ratio is clamped both by `PANE_RATIO_MIN/MAX` and an absolute `minPanePx` (default 80), and rAF-coalesces divider drag updates (eliminates 100Hz trackpad bursts → ResizeObserver→fit→SIGWINCH cascade). Handle is `role="separator"` + `tabIndex=0` with arrow-key adjustment (5% / 1% fine with Shift).

### Themed Context Menu

- React Portal menu in `src/renderer/components/context-menu/` driven by `context-menu-store.ts`. Colors bind to CSS variables (`--bg-primary`, `--hover`, `--border`, …) so theme switches update the open menu live.
- Replaces the legacy native `Menu.buildFromTemplate` IPC path (removed). Copy/Paste reuses shared `paste-from-clipboard.ts` (image + text); Split actions extend the menu dynamically from `terminal-context-actions.ts`.
- Menu captures `document.activeElement` on open and restores focus on close (keyboard-a11y). App closes the menu on `activeProjectId` change so stale closures to defunct terminals cannot fire.
- Paste pipeline: CRLF normalization → (bracketed mode on) strip inner `\x1b[20[01]~` sentinels → wrap → chunk at 64 KB with setTimeout yield. Sentinel stripping prevents attacker-controlled clipboard content from escaping the paste region into typed shell input.

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

### Media

- read-data-url — renderer requests size-capped thumbnail (80×60) as base64 data URL

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

### Image Store

`src/renderer/stores/image-store.ts` tracks per-terminal images and videos:

- `addImage(terminalId, filePath, type)` — registers a dropped image/video
- `getImages(terminalId)` — retrieves all entries for a terminal
- `removeImage(terminalId, filePath)` — removes entry and returns it (used by attachment-strip remove button)
- `clearImages(terminalId)` — clears all entries for a terminal (on Enter or Ctrl+C)

Entries include `filePath`, `timestamp`, `type` ('image' | 'video'), and 1-based `index` per type for Claude Code [Image N] token generation.

### Settings Store

The settings store uses a pending/saved split:

- `pendingSettings` drives the live UI preview
- `savedSettings` is the persisted source of truth
- changes are applied in the renderer and committed on Save

### Other Stores

- `notification-store.ts` handles notification preferences and sound state
- `update-store.ts` tracks update state
- `toast-store.ts` queues UI toasts

### Telegram Mobile Control + HTML Preview

- **Main process**: `src/main/notification/mobile-control-manager.ts` orchestrates `HookServer` + `HookRouter` + `HookInstaller` + `ResponseStore`.
- **Hook server**: Loopback-only HTTP (127.0.0.1, ephemeral port), `X-MC-Hook-Secret` via `timingSafeEqual`, body limit 1MB, handler exceptions → 200 (never block agent).
- **Hook routing**: Routes `PermissionRequest`, `AskUserQuestion`, `review-needed`, `terminal-output`.
- **Hook installer**: Writes `.claude/hooks/*.mjs`, detects ccpoke coexistence.
- **Settings UI**: `src/renderer/components/settings/mobile-control-settings.tsx` (toggle, QR deep-link, port, secret fingerprint).

### Notification Watcher + Pattern Detection

- **Pipeline**: Output → `PatternDetector` → `HookRouter` / `Telegram` / `Discord`.
- **Pattern tightening**: `plain-text-parser.ts` tightened `REVIEW_PROMPT_PATTERN` to reject loose "approve"/"waiting" matches; fixes false-trigger on terminal resize.
- **Categories**: tool-approval, review-needed, error, warning, task-coordination.
- **Multi-agent**: `AGENT_DETECTION_PATTERNS` detect Claude, Codex, Gemini, Aider.
- **Ghost terminal cache**: TTL 30min, max 50, for callback button after exit.

## Dependencies

Core runtime dependencies include:

- Electron 33
- React 19
- TypeScript 5
- Vite 6
- `node-pty` with suspend/resume
- `xterm.js` v6 + `@xterm/headless` v6
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

### Warp-Style Terminal Refresh + Snapshot Restore

- **Main process mirror**: `src/main/terminal/terminal-manager.ts` maintains one `@xterm/headless` instance per PTY (with `SerializeAddon`) in parallel to the PTY. Every byte the PTY emits writes to headless first, then broadcasts IPC.
- **IPC flow**: `terminal:get-snapshot` invoke returns serialized headless state as string via `SerializeAddon`; renderer writes it into xterm as initial state.
- **System resume**: `powerMonitor.on('resume')` triggers 2s debounced handler; sends `terminal:system-resumed` IPC to trigger silent snapshot re-fetch for all mounted terminals.
- **Alt-buffer caveat**: Interactive programs (vim, tmux, less) manage their own screen and require keystroke/resize signal to repaint; refresh button restores scrollback but cannot force repaint if OS blanked the PTY on suspend.

### Context Window Analyzer

- **Main module**: `src/main/context/*` — `ContextWindowAnalyzer` (EventEmitter) subscribes to `ClaudeLogWatcher` JSONL stream, parses each line under `try/catch`, sorts into 6 categories (claude-md, mentioned-file, tool-output, thinking-text, task-coordination, user-messages), and emits snapshot at 300ms debounce with per-session 1h TTL.
- **IPC channels**: `context:get(sessionId)` invoke + `context:snapshot` broadcast.
- **Renderer**: `ContextWindowDrawer` mounts when `enableContextWindow` flag is true; binds to active pane's `claudeSessionId` via `useContextSnapshot` hook; exposes `isStale` indicator (>10s no update from main process).
- **Feature flag**: `AppSettings.enableContextWindow` (default `true`, startup-only). Main analyzer + IPC handlers instantiated only when enabled; renderer drawer gated on same setting.
- **Error handling**: Malformed JSONL logged as single `error` event per session; main process never crashes.

## Related Docs

- [System Architecture](./system-architecture.md)
- [Project Overview & PDR](./project-overview-pdr.md)
- [Tech Stack](./tech-stack.md)
