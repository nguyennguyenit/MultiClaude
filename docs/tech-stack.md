# MultiClaude Tech Stack

## Core Technologies

| Layer | Technology | Version | Purpose |
|-------|------------|---------|---------|
| **Desktop** | Electron | ^33.x | Desktop app framework |
| **Frontend** | React | ^19.x | UI components |
| **Language** | TypeScript | ^5.x | Type safety |
| **Build** | Vite | ^6.x | Fast bundling |
| **Terminal** | node-pty | ^1.x | PTY process spawning |
| **Terminal UI** | xterm.js | ^5.x | Terminal rendering |
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
- `@lydell/node-pty`: PTY process spawning with suspend/resume support
- `electron-store`: Persistence with validation firewall for settings
- `simple-git`: Git operations wrapper
- `electron-updater`: Auto-update system

### Renderer Process (React 19)
- `@xterm/xterm`: Terminal rendering with keyboard enhancements
- `@xterm/addon-fit`: Auto-resize with debounce
- `@xterm/addon-webgl`: GPU rendering (3 modes: Performance/Balanced/Quality)
- `zustand`: State management (app + settings stores)
- `tailwindcss`: Styling with CSS variable overrides
- `@fontsource/*`: 10 font families with Nerd Font symbol fallbacks
- **Terminal Features**: OSC parsing (escape sequences), output buffering with intelligent trim, smart scroll with scroll-to-bottom button

### Shared
- `@shared/types`: Terminal, Project, Settings, NotificationEvent, TerminalLimit, WindowsShell
- `@shared/constants`: IPC channels, theme definitions, terminal rendering modes

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
2. **IPC for Terminal Data**: Bidirectional streaming for PTY I/O and settings
3. **electron-store Validation**: Firewall in main process validates all settings before persistence
4. **Dual Settings Architecture**: Pending (preview) + Saved (disk) with deep equality checks
5. **Terminal Limits**: Configurable per-app, per-project layout respects limit
6. **System Suspend/Resume**: Pause PTY operations during system sleep to prevent SIGTRAP
7. **Three Rendering Modes**: Performance (no GPU), Balanced (active only), Quality (always on)
8. **Claude-safe Mode**: Experimental toggle to keep Claude terminals on canvas renderer
9. **GitHub CLI for Auth**: Use `gh` CLI for OAuth (proven, maintained)
10. **Terminal Limit Presets**: 2, 4, 9, or custom (1-99) to manage resource load
11. **Windows Shell Selection**: cmd, PowerShell (pwsh), or WSL distros with validation
12. **Smart Terminal Selection**: Remember lastActiveTerminalByProjectId for smooth workflow

## Terminal Grid Layout

The terminal grid auto-splits based on terminal count and respects configured limit:

| Terminals | Layout | Notes |
|-----------|--------|-------|
| 1 | 1x1 | Single full-size terminal |
| 2 | 1x2 | Side-by-side |
| 3-4 | 2x2 | 2x2 grid |
| 5-6 | 2x3 | 2 rows x 3 cols |
| 7-9 | 3x3 | 3x3 grid |
| 10-12 | 3x4 | 3 rows x 4 cols |

**Terminal Limit**: Configured in Settings (Terminals tab), presets or custom 1-99
- Limits max concurrent terminals per project
- Prevents UI lag and resource exhaustion
- Enforced at spawn time

**Components:**
- `TerminalGrid`: Calculates dimensions respecting terminal limit; equal-split layout
- `TerminalPane`: Pane wrapper with click-to-focus, resize observer, bottom tab bar
- `TerminalView`: xterm.js + WebGL addon with theme colors and keyboard handling
