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
- `@xterm/addon-webgl`: GPU-accelerated rendering
- `zustand`: State management
- `tailwindcss`: Styling

## Architecture Decisions

1. **node-pty in Main Process**: PTY must run in main process (Node.js native module)
2. **IPC for Terminal Data**: Bidirectional streaming via IPC channels
3. **JSON Store for Persistence**: Simple file-based storage for sessions/projects
4. **GitHub CLI for Auth**: Use `gh` CLI for OAuth flow (proven, maintained)
5. **localStorage for Settings**: Theme preferences persisted in renderer via Zustand + localStorage
