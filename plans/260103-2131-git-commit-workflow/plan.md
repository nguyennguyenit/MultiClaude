---
title: "Git Commit Workflow Feature"
description: "Add dedicated Git panel with stage/unstage, commit, inline diff, and discard functionality"
status: completed
priority: P1
effort: 6h
issue: null
branch: master
tags: [feature, frontend, backend, git]
created: 2026-01-03
completed: 2026-01-03
---

# Git Commit Workflow Implementation Plan

## Overview

Implement Phase 1 of Git integration: core commit workflow with dedicated collapsible Git panel.

**Related:** [Brainstorm Report](../reports/brainstorm-260103-2131-git-github-features.md)

## Phases

| # | Phase | Status | Effort | Link |
|---|-------|--------|--------|------|
| 1 | Backend: GitManager Extension | Completed | 1.5h | [phase-01](./phase-01-backend-git-manager.md) |
| 2 | IPC & Preload Layer | Completed | 1h | [phase-02](./phase-02-ipc-preload.md) |
| 3 | Frontend: Git Panel Components | Completed | 2.5h | [phase-03](./phase-03-frontend-git-panel.md) |
| 4 | Integration & Layout | Completed | 1h | [phase-04](./phase-04-integration-layout.md) |

## Architecture

```
┌────────────────────────────────────────────────────────────────┐
│ Main Process (Electron)                                        │
│ ┌──────────────────────────────────────────────────────────┐  │
│ │ GitManager (src/main/git/git-manager.ts)                 │  │
│ │  - getFileStatus() ← NEW                                 │  │
│ │  - stageFile() ← NEW                                     │  │
│ │  - unstageFile() ← NEW                                   │  │
│ │  - stageAll() ← NEW                                      │  │
│ │  - commit() ← NEW                                        │  │
│ │  - getDiff() ← NEW                                       │  │
│ │  - discardChanges() ← NEW                                │  │
│ └──────────────────────────────────────────────────────────┘  │
│                           ↓ IPC                                │
├────────────────────────────────────────────────────────────────┤
│ Renderer Process (React)                                       │
│ ┌──────────────────────────────────────────────────────────┐  │
│ │ GitPanel (src/renderer/components/git-panel/)            │  │
│ │  - git-panel.tsx (container, toggle)                     │  │
│ │  - changes-list.tsx (staged/unstaged files)              │  │
│ │  - diff-viewer.tsx (inline unified diff)                 │  │
│ │  - commit-form.tsx (message input + button)              │  │
│ └──────────────────────────────────────────────────────────┘  │
│ ┌──────────────────────────────────────────────────────────┐  │
│ │ useGitPanel hook (state management)                      │  │
│ └──────────────────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────────────────┘
```

## UI Layout

```
┌─────────────────────────────────────────────────────────────┐
│ Project Tabs                                                │
├────────┬───────────────────────────┬───────────────────────┤
│Sidebar │   Terminal Grid           │ Git Panel (280px)     │
│ 256px  │   (flex-1)                │ [Toggle: Git icon]    │
│        │                           │ ┌─────────────────┐   │
│        │                           │ │ Staged (1)      │   │
│        │                           │ │  ✓ file.ts      │   │
│        │                           │ ├─────────────────┤   │
│        │                           │ │ Changes (2)     │   │
│        │                           │ │  ○ other.ts     │   │
│        │                           │ │  ○ new.ts       │   │
│        │                           │ ├─────────────────┤   │
│        │                           │ │ [Diff preview]  │   │
│        │                           │ ├─────────────────┤   │
│        │                           │ │ Commit msg...   │   │
│        │                           │ │ [Commit]        │   │
│        │                           │ └─────────────────┘   │
└────────┴───────────────────────────┴───────────────────────┘
```

## Dependencies

- `simple-git` (existing) - Git operations
- No new dependencies required

## Key Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Diff display | Plain text with +/- prefixes | KISS, no extra deps |
| State management | Local hook (useGitPanel) | Scoped to panel, not global |
| Panel position | Right of terminal grid | VS Code-like UX |
| Panel width | Fixed 280px when open | Consistent, non-intrusive |

## Success Criteria

- [ ] User can view staged/unstaged/untracked files in panel
- [ ] Click file to stage/unstage
- [ ] View inline diff for selected file
- [ ] Enter commit message and commit
- [ ] Discard unstaged changes for specific file
- [ ] Panel toggle remembers state per session
- [ ] Works with existing Git sidebar section
