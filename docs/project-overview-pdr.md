# MultiClaude Project Overview and PDR

## Product Summary

**MultiClaude** is an Electron-based desktop application for managing multiple Claude Code instances simultaneously. It provides a multi-agent terminal environment with project management, Git/GitHub integration, and notification systems.

| Attribute | Value |
|-----------|-------|
| Version | 3.4.4 |
| License | MIT |
| Platforms | Linux (AppImage/deb), macOS (dmg), Windows (exe) |
| Repository | github.com/nguyennguyenit/MultiClaude |

## Core Value Proposition

- **Multi-Agent Workflow**: Run up to 99 Claude Code instances in parallel with resizable pane tree (tmux/iTerm-style splits)
- **Project Isolation**: Per-project pane tree layouts with session persistence and warp-style snapshot restore
- **Context Intelligence**: Real-time token usage breakdown by category (claude-md, mentioned-file, tool-output, thinking-text, task-coordination, user-messages)
- **Git Integration**: Visual git panel with commit, branch, stash, and history management
- **Notifications**: Task completion alerts via native OS, Telegram (with HTML preview & mobile control), and Discord; multi-agent detection

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
| FR-6.2 | 5 Terminal ANSI palette themes (Tokyo Night, Catppuccin Mocha, Dracula, Rosé Pine, Pro Dark) | Complete | xterm v6 color integration |
| FR-6.3 | Settings slide panel with 4 tabs (Appearance, Terminals, Notifications, Updates) | Complete | Modal-free slide from right/bottom |
| FR-6.4 | Terminal rendering mode selector (Performance/Balanced/Quality) with Claude-safe toggle | Complete | WebGL + GPU control + xterm v6 |
| FR-6.5 | Terminal limit presets (2, 4, 9, custom) to constrain concurrent terminals | Complete | Enforced at spawn time |
| FR-6.6 | Windows shell selector: cmd, PowerShell, WSL distros with persistent storage | Complete | Per-project shell choice |
| FR-6.7 | Settings pending/saved flow: preview changes before persisting; hasUnsavedChanges tracking | Complete | Field-by-field equality check |
| FR-6.8 | Context window analyzer toggle in Terminal Settings (requires restart) | Complete | Breakdown by 6 categories + isStale indicator |

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

### Completed (v3.4.4)
- Pane tree layout with resizable splits (tmux/iTerm-style binary split tree)
- Per-project pane tree persistence (schemaVersion 2 with legacy flat → tree migration)
- xterm.js v6 upgrade with @xterm/headless mirror for canonical visual state
- Warp-style terminal snapshot restore with system resume handling
- Terminal output rAF-coalesce for divider drag (eliminates 100Hz trackpad bursts)
- Context window analyzer with 6-category breakdown + JSONL stream + IPC broadcast
- Image/video attachment thumbnail strip (80×60px) with per-terminal registry
- Telegram mobile control with HTML preview + Webhook routing
- Multi-agent detection (Claude, Codex, Gemini, Aider) in notifications
- Notification watcher with tool-approval, error, warning, review-needed patterns
- 7 UI themes + 5 terminal ANSI palettes (Tokyo Night, Catppuccin Mocha, Dracula, Rosé Pine, Pro Dark)
- Terminal rendering modes (Performance/Balanced/Quality) with Claude-safe toggle
- Windows shell selection (cmd, PowerShell, WSL distros) with UNC path conversion
- System suspend/resume handling with powerMonitor + 2s debounce
- Vietnamese IME auto-patch with status detection

### Planned (v3.5.x)
- Terminal output search with context preservation
- Git merge conflict resolution UI
- Multi-window support for side-by-side projects
- Context analyzer export (JSON/CSV format)

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
| @lydell/node-pty | ^1.0.0 | PTY spawning with suspend/resume |
| @xterm/xterm | ^6.x | Terminal rendering (v6 upgrade) |
| @xterm/headless | ^6.x | Canonical visual state mirror |
| @xterm/addon-webgl | ^0.18.0+ | GPU acceleration (xterm v6) |
| @xterm/addon-serialize | ^0.14.0+ | Snapshot serialization |
| electron-store | ^8.2.0 | Persistence with validation |
| electron-updater | ^6.6.2 | Auto-updates |
| simple-git | ^3.27.0 | Git operations |
| zustand | ^5.0.2 | State management |
| react | ^19.0.0 | UI framework |

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
