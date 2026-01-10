# MultiClaude

Multi-agent terminal manager for Claude Code. Run multiple Claude Code instances simultaneously, manage projects, and integrate with Git/GitHub.

## Download

Get the latest version from [GitHub Releases](https://github.com/nguyennguyenit/MultiClaude/releases).

| Platform | Download |
|----------|----------|
| Linux | `.AppImage` or `.deb` |
| macOS | `.dmg` |
| Windows | `.exe` installer |

### First Run Notes

- **macOS**: Run `xattr -cr /Applications/MultiClaude.app` in Terminal to remove quarantine, then open the app
- **Windows**: Click "More info" > "Run anyway" (for SmartScreen warning)
- **Linux AppImage**: Make executable with `chmod +x MultiClaude-*.AppImage`

## Features

- **Multi-Agent Terminals**: Up to 12 terminals in auto-split grid layout
- **Project Management**: Per-project terminal layouts with session persistence
- **Git Integration**: Visual git panel with staging, commits, branches, stash, history
- **GitHub Integration**: Login via gh CLI, create repos, view issues/PRs
- **Notifications**: Task alerts via native OS, Telegram, or Discord
- **Themes**: 7 color themes + light/dark/system mode
- **Terminal Rendering**: Configurable WebGL modes (Performance/Balanced/Quality)
- **Auto-Updates**: In-app updates with changelog display

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
| Styling | Tailwind CSS 3 |
| State | Zustand |
| Persistence | electron-store |
| Git | simple-git + gh CLI |
| Updates | electron-updater |

## Project Structure

```
src/
├── main/             # Electron main process
│   ├── terminal/     # PTY terminal management
│   ├── git/          # Git operations
│   ├── project/      # Project store
│   ├── notification/ # Telegram/Discord notifications
│   ├── clipboard/    # Clipboard image handling
│   ├── updater/      # Auto-update system
│   └── ipc/          # IPC handlers
├── renderer/         # React UI
│   ├── components/   # UI components
│   ├── hooks/        # Custom hooks
│   └── stores/       # Zustand stores
├── preload/          # Electron preload script
└── shared/           # Shared types and constants
```

## Requirements

- Node.js 18+
- GitHub CLI (`gh`) for GitHub integration
- Claude Code CLI for running Claude
- **Windows WSL**: If using WSL shell, you must install a Linux distribution:
  ```powershell
  wsl --install -d Ubuntu
  ```
  > Error `WSL_E_DISTRO_NOT_FOUND` means WSL is installed but no distribution exists. Run the command above to fix.

  > **Note**: WSL terminals take 2-5 seconds to start (cold start) due to Linux kernel initialization. Subsequent terminals are faster while WSL is running.

## Usage

1. **Add Project**: Click the + button in the sidebar to add a project folder
2. **Create Terminal**: Click the + button in the terminal tab bar
3. **Start Claude**: Click "Start Claude" to invoke Claude Code in the active terminal
4. **Git Integration**: Use the Git panel in sidebar for staging, commits, branches

### Keyboard Shortcuts

| Action | Shortcut |
|--------|----------|
| Switch to Project 1-9 | Alt+1 to Alt+9 |
| New Terminal | Ctrl+N or Ctrl+T |
| Close Active Terminal | Ctrl+W |
| Open URL | Ctrl+Click link (Cmd+Click on macOS) |
| Copy | Select text (auto-copies) |
| Paste | Right-click or Ctrl+V |
| Paste Image | Ctrl+V (clipboard image > temp file > insert path) |
| Insert File Path | Drag-and-drop file |

> **Note:** All shortcuts work regardless of terminal focus. On macOS, Cmd replaces Ctrl (Alt shortcuts unchanged).

## Notifications

Configure in Settings > Notifications:

| Platform | Configuration |
|----------|---------------|
| Native OS | Always enabled |
| Telegram | Bot token + Chat ID |
| Discord | Webhook URL |

Detected events: Task Complete, Task Failed, Review Needed

## Terminal Rendering Modes

Configure in Settings > Terminals:

| Mode | Description |
|------|-------------|
| Performance | No WebGL, best for many terminals |
| Balanced | WebGL on active terminal only (default) |
| Quality | WebGL always enabled, best visuals |

## Documentation

See [docs/](./docs/) for detailed documentation:

- [Project Overview & PDR](./docs/project-overview-pdr.md)
- [System Architecture](./docs/system-architecture.md)
- [Code Standards](./docs/code-standards.md)
- [Codebase Summary](./docs/codebase-summary.md)
- [Tech Stack](./docs/tech-stack.md)

## Development

```bash
npm run electron:dev    # Dev with hot reload
npm run build           # Production build
npm test                # Run tests
npm run test:coverage   # Coverage report
npm run typecheck       # Type checking
```

## Release

```bash
npm run version:patch   # Bump version (creates git tag)
npm run release         # Build + publish to GitHub Releases
```

Platform-specific: `release:linux`, `release:win`, `release:mac`

## License

MIT
