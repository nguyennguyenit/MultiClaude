---
title: "UI Redesign Phase 2: Terminal View Enhancement"
description: "Add terminal action bar with status display, YOLO toggle, and enhanced pane header"
status: completed
priority: P1
effort: 2h
branch: master
tags: [frontend, ui, terminal, redesign]
created: 2026-01-04
completed: 2026-01-04
---

# UI Redesign Phase 2: Terminal View Enhancement

## Overview

Enhance terminal view with action bar and improved pane header following design spec.

## Design Reference

- Spec: `plans/UX-UI/MultiClaude-UI-UX-Design.md` (lines 181-283)
- Phase 1: `plans/260104-0335-ui-redesign-phase1/`

## Phases

| # | Phase | Status | Effort | Link |
|---|-------|--------|--------|------|
| 1 | Terminal Action Bar | Completed | 2h | [phase-01](./phase-01-terminal-action-bar.md) |
| 2 | YOLO Mode Migration | Completed (already done) | - | [phase-02-yolo-mode-migration.md](./phase-02-yolo-mode-migration.md) |
| 3 | Terminal Pane Polish | Skipped (not needed) | - | [phase-03](./phase-03-terminal-pane-polish.md) |

## Key Components

### Terminal Action Bar
```
┌─────────────────────────────────────────────────────────────────┐
│  📟 1 / 9 terminals            │  + New  ⚡ YOLO ○  ✕ Kill All │
└─────────────────────────────────────────────────────────────────┘
```

### Terminal Pane Header (Enhanced)
```
┌──────────────────────────────────────────────────────┐
│ Terminal 1                        📋  ⚡  📌  ✕     │
└──────────────────────────────────────────────────────┘
```

## Files Summary

### Create
- `src/renderer/components/terminal/terminal-action-bar.tsx`

### Modify
- `src/renderer/App.tsx` - integrate action bar
- `src/renderer/components/terminal/terminal-pane.tsx` - add copy button
- `src/renderer/components/sidebar/sidebar.tsx` - remove YOLO from Tools

## Dependencies

- Phase 1: Layout Foundation (optional, can run independently)
- Existing: YOLO IPC handlers, terminal limit settings

---

## Validation Summary

**Validated:** 2026-01-04
**Questions asked:** 6

### Confirmed Decisions

| Decision | User Choice |
|----------|-------------|
| YoloToggle handling | Duplicate in action bar, cleanup from sidebar after |
| Kill All confirmation | Add confirm dialog before killing |
| Pin button | Skip for now (future feature) |
| Copy button | Skip - xterm auto-copy on select is sufficient |
| Sidebar Tools section | Remove entire section (all tools move to action bar) |
| Action bar visibility | Hide when no terminals |

### Action Items (Plan Revisions Needed)

- [x] **Phase 1**: Add confirm dialog to Kill All handler
- [x] **Phase 1**: Action bar should hide when `terminalCount === 0`
- [x] **Phase 2**: Remove entire Tools section from sidebar (not just YOLO) - already done
- [x] **Phase 3**: Delete entirely - Copy button no longer needed
- [x] Update effort: ~2h (Phase 3 removed, Phase 2 already done)
