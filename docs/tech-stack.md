# MultiClaude Tech Stack

## Core Technologies

| Layer | Technology | Version | Purpose |
|-------|------------|---------|---------|
| **Desktop** | Electron | ^33.x | Desktop app framework |
| **Frontend** | React | ^19.x | UI components |
| **Language** | TypeScript | ^5.x | Type safety |
| **Build** | Vite | ^6.x | Fast bundling |
| **Terminal** | node-pty | ^1.x | PTY spawning with suspend/resume |
| **Terminal UI** | xterm.js | ^6.x | Terminal rendering (v6) |
| **Terminal Mirror** | @xterm/headless | ^6.x | Canonical visual state |
| **Terminal Snapshot** | @xterm/addon-serialize | ^0.14.0+ | Serialize/restore state |
| **Terminal WebGL** | @xterm/addon-webgl | ^0.18.0+ | GPU acceleration (xterm v6) |
| **Styling** | Tailwind CSS | ^4.x | Utility-first CSS |
| **Testing** | Vitest | ^4.x | Unit/integration testing |

## Project Structure

```
multiclaude/
├── src/
│   ├── main/                    # Electron main process
│   │   ├── index.ts             # Main entry point
│   │   ├── terminal/            # Terminal management
│   │   │   ├── terminal-manager.ts
│   │   │   └── pty-handler.ts
│   │   ├── git/                 # Git operations
│   │   │   ├── git-manager.ts
│   │   │   └── github-auth.ts
│   │   ├── project/             # Project management
│   │   │   └── project-store.ts
│   │   └── ipc/                 # IPC handlers
│   │       └── handlers.ts
│   ├── renderer/                # React frontend
│   │   ├── App.tsx
│   │   ├── components/
│   │   │   ├── terminal/
│   │   │   │   ├── terminal-grid.tsx    # Auto-split grid layout
│   │   │   │   ├── terminal-pane.tsx    # Resizable pane wrapper
│   │   │   │   ├── terminal-view.tsx    # xterm.js renderer
│   │   │   │   ├── terminal-tabs.tsx    # Tab bar
│   │   │   │   └── index.ts
│   │   │   ├── sidebar/
│   │   │   ├── settings/
│   │   │   └── projects/
│   │   ├── hooks/
│   │   └── stores/
│   ├── preload/                 # Electron preload
│   │   └── index.ts
│   └── shared/                  # Shared types
│       ├── types/
│       └── constants/
├── docs/
├── plans/
└── package.json
```

## Key Dependencies

### Main Process
- `@lydell/node-pty`: PTY spawning with suspend/resume (powerMonitor)
- `@xterm/headless`: Canonical visual state mirror (per-PTY)
- `electron-store`: Persistence with validation firewall (projects, settings, layouts)
- `simple-git`: Git operations wrapper
- `electron-updater`: Auto-update system (GitHub Releases)

### Renderer Process (React 19)
- `@xterm/xterm`: Terminal rendering v6 with keyboard enhancements
- `@xterm/addon-fit`: Auto-resize with debounce
- `@xterm/addon-serialize`: Snapshot serialization for warp-style refresh
- `@xterm/addon-webgl`: Lazy GPU rendering under the Automatic/Prefer GPU/Compatibility policy
- `zustand`: State management (app + settings + pane-tree + context stores)
- `tailwindcss`: Styling with CSS variable overrides for 7 themes
- `@fontsource/*`: Font families with Nerd Font symbol fallbacks
- **Terminal Features**: OSC escape sequence parsing, output buffering with intelligent trim, smart scroll with scroll-to-bottom, rAF-coalesced divider drag, system resume recovery

### Shared
- `@shared/types`: Terminal, Project, Settings, NotificationEvent, TerminalLimit, WindowsShell
- `@shared/constants`: IPC channels, theme definitions, and canonical renderer policy defaults

### Shared Components
- `ToggleSwitch`: Reusable settings control for boolean toggles
- `UpdateBanner`: Visual state management for app updates

### Testing
- `vitest`: Test runner with Vite integration
- `@vitest/coverage-v8`: Code coverage via V8

## Testing Infrastructure

### Configuration
- **Config**: `vitest.config.ts` with globals enabled, node environment
- **Setup**: `src/main/__tests__/setup.ts` for global mocks
- **Coverage**: V8 provider with 60% thresholds (statements, branches, functions, lines)
- **Path Aliases**: `@shared`, `@main`, `@renderer` mapped for tests

### Test Commands
| Command | Description |
|---------|-------------|
| `npm test` | Run tests once |
| `npm run test:watch` | Watch mode |
| `npm run test:coverage` | Run with coverage report |

### Mocks
- `electron-store`: In-memory mock store with get/set
- `@lydell/node-pty`: Mock PTY with stubbed lifecycle methods

## Architecture Decisions

1. **node-pty in Main Process**: Native module requires main process execution
2. **@xterm/headless Mirror**: Canonical visual state before IPC broadcast (no render-order races)
3. **IPC for Terminal Data**: Bidirectional streaming for PTY I/O, context, and settings
4. **electron-store Validation**: Firewall in main process validates all settings before persistence
5. **Dual Settings Architecture**: Pending (preview) + Saved (disk) with deep equality checks
6. **Pane Tree Layout**: Binary split tree (tmux/iTerm-style) with schemaVersion 2 + migration
7. **Terminal Limits**: Configurable per-app (2, 4, 9, custom 1-99), enforced at spawn
8. **System Suspend/Resume**: powerMonitor pause + 2s debounce resync (prevents SIGTRAP)
9. **rAF-Coalesced Divider**: Drag updates batched (eliminates 100Hz trackpad bursts)
10. **Renderer Policy**: Automatic (default), Prefer GPU, or Compatibility (`safe-dom`)
11. **Session-local Fallback**: one xterm.js DOM/WebGL controller owns lazy load, context-loss suppression, retry, and disposal; Claude and Codex resolve to DOM under Automatic
12. **GitHub CLI for Auth**: Use `gh` CLI for OAuth (proven, maintained)
13. **Windows Shell Selection**: cmd, PowerShell, WSL distros with validation + UNC conversion
14. **Context Window Analyzer**: 300ms debounce snapshot, 6-category breakdown, 1h TTL

## Terminal Pane Tree Layout

The terminal pane tree uses binary split layout (tmux/iTerm-style):

- **Single Terminal**: 1x1 full-size pane
- **Two Terminals**: Split vertically (left/right) or horizontally (top/bottom) via context menu or hotkey
- **N Terminals**: Recursive binary splits with resizable handles and configurable split direction
- **Split Actions**: Ctrl+Shift+→/←/↓/↑ hotkeys; right-click context menu; split-button dropdown
- **Resize**: Pointer capture on handle; rAF-coalesced updates; handles for accessibility (role="separator")

**Terminal Limit**: Configured in Settings (Terminals tab), presets or custom 1-99
- Limits max concurrent terminals per project
- Prevents UI lag and resource exhaustion
- Enforced at spawn time (rejects create if limit reached)

**Components:**
- `TerminalGrid`: Mounts all project grids, hides inactive ones
- `PaneTreeNode`: Recursive flex renderer (split or pane)
- `TerminalPane`: Pane wrapper with title, tabs, action buttons, attachment strip
- `TerminalView`: xterm.js v6 + headless mirror + WebGL addon
- `ResizeHandle`: rAF-coalesced divider with keyboard a11y
