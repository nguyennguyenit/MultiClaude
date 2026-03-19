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
- `@lydell/node-pty`: Fork of node-pty with better build support
- `electron-store`: Simple data persistence
- `simple-git`: Git operations wrapper

### Renderer Process
- `@xterm/xterm`: Terminal rendering
- `@xterm/addon-fit`: Auto-resize terminal
- `@xterm/addon-webgl`: GPU-accelerated rendering (configurable modes: Performance/Balanced/Quality)
- `react-resizable-panels`: Auto-split terminal grid layout
- `zustand`: State management
- `tailwindcss`: Styling
- `@fontsource/*`: 10 font families (JetBrains Mono, Source Code Pro, Fira Code, IBM Plex Mono, Space Mono, Geist, Inter, Plus Jakarta Sans, Roboto, Ubuntu)
- **Node.js**: 24+ (enforced in CI via GitHub Actions)

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

1. **node-pty in Main Process**: PTY must run in main process (Node.js native module)
2. **IPC for Terminal Data**: Bidirectional streaming via IPC channels
3. **JSON Store for Persistence**: Simple file-based storage for sessions/projects
4. **GitHub CLI for Auth**: Use `gh` CLI for OAuth flow (proven, maintained)
5. **electron-store for Settings**: Theme/sound preferences persisted via SettingsStore in main process
6. **Auto-Split Terminal Grid**: All terminals visible simultaneously in resizable grid layout
7. **PowerShell on Windows**: Prefer pwsh over cmd for better compatibility
8. **WSL UNC Path Conversion**: Convert `\\wsl$\distro\...` paths to Linux paths for folder operations

## Terminal Grid Layout

The terminal grid auto-splits based on terminal count:

| Terminals | Layout |
|-----------|--------|
| 1 | 1x1 |
| 2 | 1x2 |
| 3-4 | 2x2 |
| 5-6 | 2x3 |
| 7-9 | 3x3 |
| 10-12 | 3x4 |

**Components:**
- `TerminalGrid`: Calculates grid dimensions, renders nested `react-resizable-panels`
- `TerminalPane`: Wrapper with click-to-focus, ResizeObserver for debounced fit
- `TerminalView`: xterm.js renderer with WebGL addon
