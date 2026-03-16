# MultiClaude Project Overview and PDR

## Product Summary

**MultiClaude** is an Electron-based desktop application for managing multiple Claude Code instances simultaneously. It provides a multi-agent terminal environment with project management, Git/GitHub integration, and notification systems.

| Attribute | Value |
|-----------|-------|
| Version | 3.0.1-beta.13 |
| License | MIT |
| Platforms | Linux (AppImage/deb), macOS (dmg), Windows (exe) |
| Repository | github.com/nguyennguyenit/MultiClaude |

## Core Value Proposition

- **Multi-Agent Workflow**: Run up to 12 Claude Code instances in parallel across a resizable grid
- **Project Isolation**: Per-project terminal layouts with session persistence
- **Git Integration**: Visual git panel with commit, branch, stash, and history management
- **Notifications**: Task completion alerts via native OS, Telegram, and Discord

## Product Development Requirements (PDR)

### Functional Requirements

#### FR-1: Terminal Management
| ID | Requirement | Status |
|----|-------------|--------|
| FR-1.1 | Spawn/destroy PTY processes via node-pty | Complete |
| FR-1.2 | Grid layout auto-adjusts (1x1 to 3x4) based on terminal count | Complete |
| FR-1.3 | WebGL rendering with configurable modes (Performance/Balanced/Quality) | Complete |
| FR-1.4 | Terminal title editing via double-click | Complete |
| FR-1.5 | Claude mode indicator badge when Claude active | Complete |
| FR-1.6 | WSL shell support (Windows): auto-detect distros, pwsh preference, right-click shell selector; WSL UNC path conversion | Complete |

#### FR-2: Project Management
| ID | Requirement | Status |
|----|-------------|--------|
| FR-2.1 | Add projects via folder picker | Complete |
| FR-2.2 | Project tab bar with Alt+1-9 switching | Complete |
| FR-2.3 | Per-project terminal layout persistence | Complete |
| FR-2.4 | Project metadata storage (name, path, gitRemote) | Complete |

#### FR-3: Git Integration
| ID | Requirement | Status |
|----|-------------|--------|
| FR-3.1 | Git status, init, add remote, push | Complete |
| FR-3.2 | File staging/unstaging with visual diff | Complete |
| FR-3.3 | Branch management (create, checkout, delete, merge) | Complete |
| FR-3.4 | Commit history viewer | Complete |
| FR-3.5 | Stash management (save, apply, pop, drop) | Complete |
| FR-3.6 | HEAD watcher for external changes; conditional mount + shared concurrency guard | Complete |

#### FR-4: GitHub Integration
| ID | Requirement | Status |
|----|-------------|--------|
| FR-4.1 | OAuth login via gh CLI | Complete |
| FR-4.2 | Create remote repository | Complete |
| FR-4.3 | Issues list viewer | Complete |
| FR-4.4 | Pull requests list viewer | Complete |

#### FR-5: Notifications
| ID | Requirement | Status |
|----|-------------|--------|
| FR-5.1 | Native OS notifications | Complete |
| FR-5.2 | Telegram bot integration | Complete |
| FR-5.3 | Discord webhook integration | Complete |
| FR-5.4 | Pattern detection (task complete, failed, review needed) | Complete |
| FR-5.5 | Sound presets (default, minimal, retro) | Complete |

#### FR-6: Settings and Themes
| ID | Requirement | Status |
|----|-------------|--------|
| FR-6.1 | 7 color themes (Default, Dusk, Lime, Ocean, Retro, Neo, Forest) | Complete |
| FR-6.2 | Light/Dark/System mode | Complete |
| FR-6.3 | Settings modal with tabbed navigation | Complete |
| FR-6.4 | Terminal rendering mode selector | Complete |

#### FR-7: Auto-Update
| ID | Requirement | Status |
|----|-------------|--------|
| FR-7.1 | Check for updates on startup | Complete |
| FR-7.2 | Download with progress indicator | Complete |
| FR-7.3 | Install and restart | Complete |
| FR-7.4 | Changelog display from GitHub Releases | Complete |

### Non-Functional Requirements

| ID | Requirement | Target | Status |
|----|-------------|--------|--------|
| NFR-1 | Startup time | <3s cold start | Met |
| NFR-2 | Memory usage | <500MB with 4 terminals (improved via git-panel conditional mount) | Met |
| NFR-3 | Terminal latency | <50ms input-to-render | Met |
| NFR-4 | Test coverage | 60% minimum | Met |
| NFR-5 | Cross-platform builds | Linux, macOS, Windows | Complete |

### Technical Constraints

1. **node-pty in Main Process**: Native module requires main process execution
2. **IPC for Terminal I/O**: Bidirectional streaming via Electron IPC
3. **electron-store for Persistence**: JSON file-based storage for projects/settings
4. **GitHub CLI Dependency**: OAuth flow via `gh` CLI tool
5. **WebGL Disposal Timing**: 150ms delay to prevent display corruption on project switch

### Security Requirements

| ID | Requirement | Implementation |
|----|-------------|----------------|
| SEC-1 | Credential encryption | Electron safeStorage for Telegram/Discord tokens |
| SEC-2 | IPC validation | Typed preload API with context isolation |
| SEC-3 | Signed releases | GitHub Releases with electron-updater |

## Feature Roadmap

### Completed (v1.1.x)
- Multi-terminal grid management
- Project tabs with persistence
- Full Git/GitHub integration
- Notification system (native/Telegram/Discord)
- Auto-update system
- 7 themes with dark/light modes
- Terminal rendering modes
- WSL shell support for Windows (auto-detect, default shell, per-terminal shell selector)

### Planned (v1.2.x)
- Terminal output search
- Git conflict resolution UI
- Multi-window support
- Plugin system for extensions

## Success Metrics

| Metric | Target | Current |
|--------|--------|---------|
| Active users | - | - |
| Crash rate | <1% sessions | - |
| Update adoption | >90% within 7 days | - |
| User-reported bugs | <5 critical/month | - |

## Dependencies

### Runtime Dependencies
| Package | Version | Purpose |
|---------|---------|---------|
| @lydell/node-pty | ^1.0.0 | PTY spawning |
| @xterm/xterm | ^5.5.0 | Terminal rendering |
| @xterm/addon-webgl | ^0.18.0 | GPU acceleration |
| electron-store | ^8.2.0 | Persistence |
| electron-updater | ^6.6.2 | Auto-updates |
| simple-git | ^3.27.0 | Git operations |
| zustand | ^5.0.2 | State management |
| react | ^19.0.0 | UI framework |
| react-resizable-panels | ^4.1.1 | Grid layout |

### Development Dependencies
| Package | Version | Purpose |
|---------|---------|---------|
| electron | ^33.3.0 | Desktop framework |
| vite | ^6.0.6 | Bundler |
| typescript | ^5.7.2 | Type safety |
| vitest | ^4.0.16 | Testing |
| electron-builder | ^25.1.8 | Packaging |

## External Dependencies

| Tool | Purpose | Required |
|------|---------|----------|
| GitHub CLI (gh) | OAuth/repo operations | For GitHub features |
| Claude Code CLI | Agent execution | For Claude features |
| Node.js 18+ | Runtime | Required |
