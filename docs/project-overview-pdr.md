# MultiClaude Project Overview and PDR

## Product Summary

**MultiClaude** is an Electron-based desktop application for managing multiple Claude Code instances simultaneously. It provides a multi-agent terminal environment with project management, Git/GitHub integration, and notification systems.

| Attribute | Value |
|-----------|-------|
| Version | 3.1.0-beta.1 |
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
| FR-1.1 | Spawn/destroy PTY processes via node-pty; system suspend/resume handling | Complete |
| FR-1.2 | Grid layout auto-adjusts based on terminal count; configurable terminal limits (2, 4, 9, custom) | Complete |
| FR-1.3 | Terminal rendering modes: Performance (no WebGL), Balanced (active only), Quality (always on) | Complete |
| FR-1.4 | Claude-safe mode: experimental toggle for GPU rendering on Claude terminals | Complete |
| FR-1.5 | Terminal title editing via double-click; Claude mode indicator badge | Complete |
| FR-1.6 | Windows shell selection: cmd, PowerShell (pwsh), WSL distros with validation and cleanup | Complete |
| FR-1.7 | Terminal keyboard enhancements: OSC title updates via escape sequences; input buffering; smart scroll with smart scroll-to-bottom button | Complete |
| FR-1.8 | Smart terminal selection: remembers lastActiveTerminalByProjectId, fallback to first or latest | Complete |
| FR-1.9 | Atomic switchToProject(): prevents race conditions, updates terminal+shell in single state operation | Complete |

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
| ID | Requirement | Status | Notes |
|----|-------------|--------|-------|
| FR-6.1 | 7 UI color themes + Light/Dark/System modes (Default, Dusk, Lime, Ocean, Retro, Neo, Forest) | Complete | Applied to app chrome |
| FR-6.2 | 5 Terminal ANSI palette themes (Tokyo Night, Catppuccin Mocha, Dracula, Rosé Pine, Pro Dark) | Complete | xterm.js colors |
| FR-6.3 | Settings panel with 4 tabs (Appearance, Terminals, Notifications, Updates) | Complete | Tabbed navigation |
| FR-6.4 | Terminal rendering mode selector (Performance/Balanced/Quality) with Claude-safe toggle | Complete | WebGL + GPU control |
| FR-6.5 | Terminal limit presets (2, 4, 9, custom) to constrain concurrent terminals | Complete | Prevents resource exhaustion |
| FR-6.6 | Windows shell selector: cmd, PowerShell, WSL distros with persistent storage | Complete | Per-project shell choice |
| FR-6.7 | Settings pending/saved flow: preview changes before persisting; hasUnsavedChanges tracking | Complete | Field-by-field equality check |
| FR-6.8 | localStorage migration: one-time automatic migration on first load per session | Complete | Backward compatibility |

#### FR-7: Auto-Update
| ID | Requirement | Status |
|----|-------------|--------|
| FR-7.1 | Check for updates on startup | Complete |
| FR-7.2 | Download with progress indicator | Complete |
| FR-7.3 | Install and restart | Complete |
| FR-7.4 | Changelog display from GitHub Releases | Complete |

#### FR-8: Vietnamese IME Support
| ID | Requirement | Status |
|----|-------------|--------|
| FR-8.1 | Auto-detect and patch Claude CLI for Vietnamese IME on startup | Complete |
| FR-8.2 | Settings UI for Vietnamese IME patch status and manual patching | Complete |
| FR-8.3 | Toast notifications for patch success/failure; version detection | Complete |

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

### Completed (v3.1.0-beta)
- Multi-terminal grid management with configurable terminal limits
- Project tabs with persistence and smart terminal selection
- Full Git/GitHub integration with visual status and stash management
- Notification system (native/Telegram/Discord) with pattern detection
- Auto-update system with changelog display
- 7 UI themes + 5 terminal color palettes with dark/light modes
- Terminal rendering modes (Performance/Balanced/Quality) with Claude-safe GPU control
- Windows shell selection (cmd, PowerShell, WSL distros) with validation
- Vietnamese IME auto-patch with status detection
- Settings pending/saved flow with deep equality checking
- System suspend/resume handling to prevent PTY crashes
- OSC escape sequence parsing for terminal title updates
- Terminal output buffering with intelligent trim strategy

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
| Node.js 24+ | Runtime | Required (enforced in CI) |
