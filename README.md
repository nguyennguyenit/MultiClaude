<div align="center">
  <p>
    <img src="./build/icon.png" alt="MultiClaude" width="120" />
  </p>

  <h1>MultiClaude</h1>

  <p>
    <a href="https://www.electronjs.org/"><img src="https://img.shields.io/badge/Electron-33-47848F?style=flat-square&logo=electron&logoColor=white" alt="Electron 33" /></a>
    <a href="https://react.dev/"><img src="https://img.shields.io/badge/React-19-61DAFB?style=flat-square&logo=react&logoColor=black" alt="React 19" /></a>
    <a href="https://www.typescriptlang.org/"><img src="https://img.shields.io/badge/TypeScript-5-3178C6?style=flat-square&logo=typescript&logoColor=white" alt="TypeScript 5" /></a>
    <a href="https://xtermjs.org/"><img src="https://img.shields.io/badge/xterm.js-Terminal-2C2C32?style=flat-square&logo=gnubash&logoColor=white" alt="xterm.js" /></a>
    <a href="https://cli.github.com/"><img src="https://img.shields.io/badge/GitHub-Integrated-181717?style=flat-square&logo=github&logoColor=white" alt="GitHub Integrated" /></a>
    <a href="./LICENSE"><img src="https://img.shields.io/badge/License-MIT-yellow?style=flat-square" alt="License: MIT" /></a>
  </p>
</div>

**MultiClaude** is a desktop workspace for running Claude Code in parallel. It lets you manage up to 12 agent terminals, keep project-scoped layouts, work with Git and GitHub without leaving the app, and receive task notifications across macOS, Windows, and Linux.

Built for developers who want the speed of Claude Code in a local terminal, but with better project switching, session persistence, and repo operations than a raw shell setup.

## What Makes It Different

- **Parallel Claude Code Workspaces**: Run up to 12 Claude Code terminals in one window with an auto-split grid that scales from focused single-terminal work to broad multi-agent runs.
- **Project-Scoped Persistence**: Each project keeps its own terminal layout, active sessions, and window state so context survives app restarts and repo switching.
- **Git + GitHub Inside the App**: Visual git status, staging, branches, stash, history, GitHub auth via `gh`, remote repo creation, plus issue and pull request views.
- **Notification Pipeline for Agent Runs**: Detect complete, failed, and review-needed output patterns, then route alerts through native OS notifications, Telegram bots, or Discord webhooks.
- **Desktop-First Terminal UX**: Native PTY terminals with configurable WebGL modes, drag-and-drop file paths, clipboard image path insertion, WSL-aware shell handling, and global shortcuts.
- **Polished Local Distribution**: Cross-platform installers, in-app auto-updates, changelog display, 10 themes, and light/dark/system appearance without requiring a backend service.

## Ecosystem

**Workflow Fit:**

| Tool | Best for | Persistent project layouts | Built-in Git panel | GitHub view | Notifications | Desktop UI |
|------|----------|----------------------------|--------------------|-------------|---------------|------------|
| Claude Code CLI | One repo, one terminal, raw speed | - | - | - | - | - |
| tmux / terminal splits | Power-user terminal multiplexing | Manual | - | - | - | - |
| MultiClaude | Parallel Claude workflows across multiple repos | ✅ | ✅ | ✅ | ✅ | ✅ |

**Feature Matrix:**

| Capability | Claude Code CLI | tmux / terminal splits | MultiClaude |
|------------|-----------------|------------------------|-------------|
| Run many Claude sessions in one workspace | Manual | ✅ | ✅ |
| Per-project terminal layout persistence | - | Manual | ✅ |
| Visual Git status, staging, branches, stash | - | - | ✅ |
| GitHub auth, repo creation, issues, PRs | - | - | ✅ |
| Native OS, Telegram, Discord notifications | - | - | ✅ |
| Cross-platform packaged desktop app | - | - | ✅ |

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

- Node.js 24+
- GitHub CLI (`gh`) for GitHub integration
- Claude Code CLI for running Claude
- **Windows**: PowerShell (pwsh) is preferred; cmd is available as fallback
- **Windows WSL**: If using WSL shell, you must install a Linux distribution:
  ```powershell
  wsl --install -d Ubuntu
  ```
  > Error `WSL_E_DISTRO_NOT_FOUND` means WSL is installed but no distribution exists. Run the command above to fix.

  > **Note**: WSL terminals take 2-5 seconds to start (cold start) due to Linux kernel initialization. Subsequent terminals are faster while WSL is running.

  > **Tip**: UNC paths (e.g., `\\wsl$\Ubuntu\home\user`) are automatically converted to Linux paths for folder operations.

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
| Open URL | Click link |
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
