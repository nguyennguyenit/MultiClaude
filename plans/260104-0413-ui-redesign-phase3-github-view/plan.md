---
title: "UI Redesign Phase 3: GitHub View"
description: "Create standalone GitHub view with action bar and reused GitPanel components"
status: completed
priority: P1
effort: 5h
branch: master
tags: [frontend, ui, github, git, redesign]
created: 2026-01-04
completed: 2026-01-04
---

# UI Redesign Phase 3: GitHub View

## Overview

Create standalone GitHub view that appears when clicking "GitHub" navigation in sidebar. Replaces current right-side GitPanel with full-width view.

## Design Reference

- Spec: `plans/UX-UI/MultiClaude-UI-UX-Design.md` (lines 287-341)
- Phase 1: `plans/260104-0335-ui-redesign-phase1/` (navigation)

## Phases

| # | Phase | Status | Effort | Link |
|---|-------|--------|--------|------|
| 1 | GitHub View Container | Completed | 1.5h | [phase-01](./phase-01-github-view-container.md) |
| 2 | GitHub Action Bar | Completed | 1.5h | [phase-02](./phase-02-github-action-bar.md) |
| 3 | Repo Info Header | Completed | 1h | [phase-03](./phase-03-repo-info-header.md) |
| 4 | Integration & Cleanup | Completed | 1h | [phase-04](./phase-04-integration.md) |

## Key Components

### Design Spec Layout
```
┌──────────────────────────────────────────────────────────────┐
│ 🔀 owner/repo                    │  ⬆️ Push  ⬇️ Pull  🔄 Sync │ ← Action Bar
├──────────────────────────────────────────────────────────────┤
│ 📂 Repository: owner/repo                                    │
│ 🌿 Branch: main                  📝 3 changes                 │ ← Repo Info
├──────────────────────────────────────────────────────────────┤
│ [ Changes ] [ History ] [ Stash ] [ Branches ]               │ ← Tabs
├──────────────────────────────────────────────────────────────┤
│                                                              │
│               Tab Content (reuse existing)                   │ ← Content
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

## Reusable Components (from git-panel/)

| Component | File | Reuse Strategy |
|-----------|------|----------------|
| useGitPanel hook | hooks/use-git-panel.ts | Direct reuse |
| BranchSelector | branch-selector.tsx | Direct reuse |
| ChangesList | changes-list.tsx | Direct reuse |
| DiffViewer | diff-viewer.tsx | Direct reuse |
| CommitForm | commit-form.tsx | Direct reuse |
| HistoryTab | history-tab.tsx | Direct reuse |
| StashTab | stash-tab.tsx | Direct reuse |
| BranchesTab | branches-tab.tsx | Direct reuse |

## Files Summary

### Create
- `src/renderer/components/github-view/github-view.tsx`
- `src/renderer/components/github-view/github-action-bar.tsx`
- `src/renderer/components/github-view/repo-info-header.tsx`
- `src/renderer/components/github-view/index.ts`

### Modify
- `src/renderer/App.tsx` - switch view based on activeView

### Delete (after Phase 4)
- Consider deprecating GitPanel right-side panel behavior

## Dependencies

- Phase 1: Layout Foundation (activeView state)
- Existing: useGitPanel hook, git-panel components, Git IPC handlers

## Validation Summary

**Validated:** 2026-01-04
**Questions asked:** 5

### Confirmed Decisions
- **Old GitPanel**: Remove entirely (not keep side-by-side)
- **Changes Tab Layout**: 3-column layout (file list | diff viewer | commit form)
- **Issues/PRs Tab**: Implement basic version with gh CLI
- **GitHub API Method**: Use gh CLI (not GitHub REST API)
- **Issues/PRs Scope**: Create as Phase 5 (separate from this phase)

### Action Items
- [x] Ensure Changes tab uses 3-column horizontal layout
- [ ] Create Phase 5 plan for Issues/PRs implementation
- [x] Update phase effort estimates accordingly
