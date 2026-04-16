# System Requirement Definition (SRD)

> Migrated from `project-overview-pdr.md` and enhanced via `/ipa:init`

## 1. Overview

**MultiClaude** is an Electron-based desktop application for managing multiple Claude Code instances simultaneously. It provides a multi-agent terminal environment with project management, Git/GitHub integration, and notification systems.

| Attribute | Value |
|-----------|-------|
| Version | 3.0.1-beta.13 |
| License | MIT |
| Platforms | Linux, macOS, Windows |
| Repository | github.com/nguyennguyenit/MultiClaude |

### Core Value Proposition

- **Multi-Agent Workflow**: Run up to 12 Claude Code instances in parallel
- **Project Isolation**: Per-project terminal layouts with session persistence
- **Git Integration**: Visual git panel with commit, branch, stash, history
- **Notifications**: Task completion alerts via native OS, Telegram, Discord

## 2. Entities

| ID | Entity | Source | Description |
|----|--------|--------|-------------|
| E-01 | Project | `projects` store | User workspace folder reference |
| E-02 | Terminal | Runtime only | PTY terminal instance |
| E-03 | TerminalLayout | `terminalLayouts` store | Per-project terminal arrangement |
| E-04 | AppSession | `session` store | Window state for restore |
| E-05 | AppSettings | `settings` store | User preferences |
| E-06 | GitStatus | IPC response | Repository state |
| E-07 | GitHubAuth | IPC response | GitHub login state |
| E-08 | Notification | Event | Task alert event |

## 3. Features

### FR-01: Terminal Management

| ID | Requirement | Status | Screen |
|----|-------------|--------|--------|
| FR-01.1 | Spawn/destroy PTY processes via node-pty | ✅ Complete | S-02 |
| FR-01.2 | Grid layout auto-adjusts (1x1 to 3x4) based on terminal count | ✅ Complete | S-02 |
| FR-01.3 | WebGL rendering with configurable modes | ✅ Complete | S-04 |
| FR-01.4 | Terminal title editing via double-click | ✅ Complete | S-02 |
| FR-01.5 | Claude mode indicator badge | ✅ Complete | S-02 |
| FR-01.6 | WSL shell support + pwsh preference + UNC path conversion | ✅ Complete | S-02, S-04 |

### FR-02: Project Management

| ID | Requirement | Status | Screen |
|----|-------------|--------|--------|
| FR-02.1 | Add projects via folder picker | ✅ Complete | S-01 |
| FR-02.2 | Project tab bar with Alt+1-9 switching | ✅ Complete | All |
| FR-02.3 | Per-project terminal layout persistence | ✅ Complete | S-02 |
| FR-02.4 | Project metadata storage | ✅ Complete | - |

### FR-03: Git Integration

| ID | Requirement | Status | Screen |
|----|-------------|--------|--------|
| FR-03.1 | Git status, init, add remote, push | ✅ Complete | S-03 (Git Slide Panel) |
| FR-03.2 | File staging/unstaging with visual diff | ✅ Complete | S-03 (Git Slide Panel) |
| FR-03.3 | Branch management (create, checkout, delete, merge) | ✅ Complete | S-03 (Git Slide Panel) |
| FR-03.4 | Commit history viewer | ✅ Complete | S-03 (Git Slide Panel) |
| FR-03.5 | Stash management | ✅ Complete | S-03 (Git Slide Panel) |
| FR-03.6 | HEAD watcher for external changes | ✅ Complete | S-03 (Git Slide Panel) |

### FR-04: GitHub Integration

| ID | Requirement | Status | Screen |
|----|-------------|--------|--------|
| FR-04.1 | OAuth login via gh CLI | ✅ Complete | S-03 |
| FR-04.2 | Create remote repository | ✅ Complete | S-03 |
| FR-04.3 | Issues list viewer | ✅ Complete | S-03 |
| FR-04.4 | Pull requests list viewer | ✅ Complete | S-03 |

### FR-05: Notifications

| ID | Requirement | Status | Screen |
|----|-------------|--------|--------|
| FR-05.1 | Native OS notifications | ✅ Complete | - |
| FR-05.2 | Telegram bot integration | ✅ Complete | S-04 |
| FR-05.3 | Discord webhook integration | ✅ Complete | S-04 |
| FR-05.4 | Pattern detection (complete, failed, review) | ✅ Complete | - |
| FR-05.5 | Sound presets | ✅ Complete | S-04 |

### FR-06: Settings and Themes

| ID | Requirement | Status | Screen |
|----|-------------|--------|--------|
| FR-06.1 | 10 color themes | ✅ Complete | S-04 |
| FR-06.2 | Light/Dark/System mode | ✅ Complete | S-04 |
| FR-06.3 | Settings modal with tabbed navigation | ✅ Complete | S-04 |
| FR-06.4 | Terminal rendering mode selector | ✅ Complete | S-04 |

### FR-07: Auto-Update

| ID | Requirement | Status | Screen |
|----|-------------|--------|--------|
| FR-07.1 | Check for updates on startup | ✅ Complete | - |
| FR-07.2 | Download with progress indicator | ✅ Complete | S-04 |
| FR-07.3 | Install and restart | ✅ Complete | S-04 |
| FR-07.4 | Changelog display from GitHub Releases | ✅ Complete | S-04 |

## 4. Screens

| ID | Screen | Route/State | Features |
|----|--------|-------------|----------|
| S-01 | Welcome | `activeProjectId = null` | FR-02.1 |
| S-02 | Terminal View | `activeView = 'terminals'` | FR-01.*, FR-02.2, FR-02.3 |
| S-03 | GitHub View | `activeView = 'github'` | FR-04.* |
| S-04 | Settings Slide Panel | `activePanel = 'settings'` | FR-05.2-5, FR-06.*, FR-07.2-4 |
| S-03 | Git Slide Panel | `activePanel = 'git'` | FR-03.* |

## 5. Non-Functional Requirements

| ID | Requirement | Target | Status |
|----|-------------|--------|--------|
| NFR-01 | Startup time | <3s cold start | ✅ Met |
| NFR-02 | Memory usage | <500MB with 4 terminals (improved via git-panel conditional mount) | ✅ Met |
| NFR-03 | Terminal latency | <50ms input-to-render | ✅ Met |
| NFR-04 | Test coverage | 60% minimum | ✅ Met |
| NFR-05 | Cross-platform builds | Linux, macOS, Windows | ✅ Complete |

## 6. Technical Constraints

| ID | Constraint | Reason |
|----|------------|--------|
| TC-01 | node-pty in Main Process | Native module requires Node.js |
| TC-02 | IPC for Terminal I/O | Electron process separation |
| TC-03 | electron-store for Persistence | Simple JSON file storage |
| TC-04 | GitHub CLI Dependency | OAuth flow via `gh` tool |
| TC-05 | WebGL Disposal Timing | 150ms delay prevents display corruption |

## 7. Security Requirements

| ID | Requirement | Implementation |
|----|-------------|----------------|
| SEC-01 | Credential encryption | `electron.safeStorage` for tokens |
| SEC-02 | IPC validation | Typed preload API with context isolation |
| SEC-03 | Signed releases | GitHub Releases with electron-updater |

## 8. External Dependencies

| Tool | Purpose | Required |
|------|---------|----------|
| GitHub CLI (gh) | OAuth/repo operations | For GitHub features |
| Claude Code CLI | Agent execution | For Claude features |
| Node.js 18+ | Runtime | Required |

## 9. Feature Roadmap

### Completed (v1.1.x)
- [x] Multi-terminal grid management
- [x] Project tabs with persistence
- [x] Full Git/GitHub integration
- [x] Notification system
- [x] Auto-update system
- [x] 10 themes with dark/light modes
- [x] Terminal rendering modes
- [x] WSL shell support (Windows)

### Planned (v1.2.x)
- [ ] Terminal output search
- [ ] Git conflict resolution UI
- [ ] Multi-window support
- [ ] Plugin system for extensions

## 10. IPA Checklist

- [x] Entities extracted from stores (E-01 to E-08)
- [x] Features migrated from PDR (FR-01 to FR-07)
- [x] Screens defined (S-01 to S-04)
- [x] Non-functional requirements (NFR-01 to NFR-05)
- [x] Technical constraints documented
- [x] Security requirements defined
- [ ] Business rules (N/A - developer tool)
- [ ] User research (N/A - existing product)

## 11. Cross-References

| Document | Purpose |
|----------|---------|
| `docs/API_SPEC.md` | IPC endpoint definitions |
| `docs/DB_DESIGN.md` | Store schema definitions |
| `docs/UI_SPEC.md` | Screen and component specs |
| `docs/tech-stack.md` | Technology stack |
| `docs/system-architecture.md` | Architecture diagrams |
| `docs/code-standards.md` | Coding conventions |
