---
title: "MultiClaude Implementation Plan"
description: "Simplified multi-agent terminal app with Git integration and project management"
status: completed
priority: P1
effort: 32h
branch: master
tags: [electron, terminal, claude-code, multi-agent]
created: 2025-12-30
---

# MultiClaude Implementation Plan

## Vision
Desktop app enabling multiple Claude Code terminals with project/session management.

## Core Features
1. **Multi-Agent Terminals** - Spawn multiple node-pty terminals, each running Claude Code
2. **Git + GitHub** - Init repos, connect to GitHub via `gh` CLI
3. **Project Switching** - Manage/switch between projects with persistent state
4. **Session Persistence** - Save/restore terminal sessions on app close/open

## Tech Stack
| Layer | Tech | Purpose |
|-------|------|---------|
| Desktop | Electron 33 | App shell |
| Frontend | React 19 + TS | UI |
| Terminal | node-pty + xterm.js | PTY + rendering |
| Styling | Tailwind CSS 4 | Utility CSS |
| State | Zustand | React state |
| Persistence | electron-store | JSON storage |
| Git | simple-git + gh CLI | Git/GitHub ops |

## Architecture
```
┌─────────────────────────────────────────────┐
│                 Renderer                     │
│  ┌─────────┐ ┌─────────┐ ┌─────────┐        │
│  │Terminal1│ │Terminal2│ │Terminal3│ ...    │
│  └────┬────┘ └────┬────┘ └────┬────┘        │
└───────┼──────────┼──────────┼───────────────┘
        │    IPC   │          │
┌───────┼──────────┼──────────┼───────────────┐
│       ▼          ▼          ▼     Main      │
│  ┌─────────────────────────────────┐        │
│  │        TerminalManager          │        │
│  │  ┌─────┐ ┌─────┐ ┌─────┐        │        │
│  │  │ PTY │ │ PTY │ │ PTY │        │        │
│  │  └─────┘ └─────┘ └─────┘        │        │
│  └─────────────────────────────────┘        │
│  ┌────────────┐ ┌────────────┐              │
│  │ GitManager │ │ProjectStore│              │
│  └────────────┘ └────────────┘              │
└─────────────────────────────────────────────┘
```

## Phases

| Phase | Name | Effort | Deliverable |
|-------|------|--------|-------------|
| 1 | [Project Setup](./phase-01-project-setup.md) | 4h | Electron + React + Vite scaffold |
| 2 | [Terminal Management](./phase-02-terminal-management.md) | 10h | Multi-terminal with node-pty |
| 3 | [Git + GitHub](./phase-03-git-github-integration.md) | 6h | Git ops + GitHub auth |
| 4 | [Project Management](./phase-04-project-management.md) | 8h | Project CRUD + switching |
| 5 | [UI Polish](./phase-05-ui-polish.md) | 4h | Styling + session persistence |

## Success Criteria
- [ ] Open 3+ Claude Code terminals simultaneously
- [ ] Create/switch projects with persisted state
- [ ] Init git repo + push to GitHub from UI
- [ ] Sessions restore after app restart

## Risks
| Risk | Mitigation |
|------|------------|
| node-pty native build issues | Use @lydell/node-pty fork |
| xterm.js memory leaks | Proper cleanup on terminal close |
| GitHub OAuth complexity | Delegate to `gh auth login` |

## Out of Scope (YAGNI)
- AI model selection (always uses claude)
- Terminal themes/customization
- Remote SSH terminals
- Plugin system
