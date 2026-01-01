# MultiClaude

Multi-agent terminal manager for Claude Code. Run multiple Claude Code instances simultaneously, manage projects, and integrate with Git/GitHub.

## Features

- **Multi-Agent Terminals**: Open multiple terminals running Claude Code simultaneously
- **Git Integration**: Initialize git repos, view status, push changes
- **GitHub Integration**: Login via GitHub CLI, create repositories
- **Project Management**: Add, switch between, and manage multiple projects
- **Session Persistence**: Terminals automatically restore on app restart
- **Theme Settings**: Light/Dark/System mode + 7 color themes (Default, Dusk, Lime, Ocean, Retro, Neo, Forest)

## Quick Start

```bash
# Install dependencies
npm install

# Run in development mode
npm run electron:dev

# Build for production
npm run build
```

## Tech Stack

| Layer | Technology |
|-------|------------|
| Desktop | Electron 33 |
| Frontend | React 19 + TypeScript |
| Terminal | node-pty + xterm.js |
| Styling | Tailwind CSS |
| State | Zustand |
| Persistence | electron-store |
| Git | simple-git + gh CLI |

## Project Structure

```
src/
├── main/           # Electron main process
│   ├── terminal/   # PTY terminal management
│   ├── git/        # Git operations
│   ├── project/    # Project store
│   └── ipc/        # IPC handlers
├── renderer/       # React UI
│   ├── components/ # UI components
│   ├── hooks/      # Custom hooks
│   └── stores/     # Zustand stores
├── preload/        # Electron preload script
└── shared/         # Shared types and constants
```

## Requirements

- Node.js 18+
- GitHub CLI (`gh`) for GitHub integration
- Claude Code CLI for running Claude

## Usage

1. **Add Project**: Click the + button in the sidebar to add a project folder
2. **Create Terminal**: Click the + button in the terminal tab bar
3. **Start Claude**: Click "Start Claude" to invoke Claude Code in the active terminal
4. **Git Integration**: Initialize git, connect to GitHub, push changes from the sidebar

### Terminal Shortcuts

| Action | Shortcut |
|--------|----------|
| Copy | Select text (auto-copies on selection) |
| Paste | Right-click |

## License

MIT
