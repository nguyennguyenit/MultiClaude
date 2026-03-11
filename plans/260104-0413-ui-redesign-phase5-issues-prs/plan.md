---
title: "UI Redesign Phase 5: Issues & PRs Tab"
description: "Add Issues/PRs tab to GitHub View using gh CLI"
status: complete
priority: P2
effort: 3h
branch: master
tags: [frontend, ui, github, issues, prs]
created: 2026-01-04
completed: 2026-01-04
---

# UI Redesign Phase 5: Issues & PRs Tab

## Overview

Add Issues and Pull Requests tab to GitHub View, fetching data via gh CLI.

## Design Reference

- Parent: `plans/260104-0413-ui-redesign-phase3-github-view/plan.md`
- Spec: `plans/UX-UI/MultiClaude-UI-UX-Design.md`

## Phases

| # | Phase | Status | Effort | Link |
|---|-------|--------|--------|------|
| 1 | Issues Tab Component | Complete | 1.5h | [phase-01](./phase-01-issues-tab.md) |
| 2 | PRs Tab Component | Complete | 1.5h | [phase-02](./phase-02-prs-tab.md) |

## Key Components

### Design Layout
```
┌──────────────────────────────────────────────────────────────┐
│ [ Changes ] [ History ] [ Stash ] [ Branches ] [ Issues/PRs ]│
├──────────────────────────────────────────────────────────────┤
│ [ Issues ] [ Pull Requests ]                      🔄 Refresh │
├──────────────────────────────────────────────────────────────┤
│ #123 Bug: Login fails on mobile        open    2h ago       │
│ #122 Feature: Add dark mode            open    1d ago       │
│ #121 Fix: Memory leak in terminal      closed  3d ago       │
└──────────────────────────────────────────────────────────────┘
```

## Technical Approach

### gh CLI Commands
```bash
# List issues
gh issue list --json number,title,state,createdAt,author,labels

# List PRs
gh pr list --json number,title,state,createdAt,author,headRefName

# View issue details
gh issue view {number} --json body,comments

# View PR details
gh pr view {number} --json body,commits,reviews,mergeable
```

### IPC Handlers Required
- `git:issues:list` - Fetch issues via gh CLI
- `git:prs:list` - Fetch PRs via gh CLI
- `git:issues:view` - Get issue details
- `git:prs:view` - Get PR details

## Files Summary

### Create
- `src/renderer/components/github-view/issues-tab.tsx`
- `src/renderer/components/github-view/prs-tab.tsx`
- `src/main/ipc/github-handlers.ts`

### Modify
- `src/renderer/components/github-view/github-view.tsx` - Add Issues/PRs tab
- `src/shared/types/index.ts` - Add Issue/PR types

## Dependencies

- Phase 3: GitHub View (must be completed first)
- gh CLI installed and authenticated on user system
