---
title: "Keyboard Shortcuts Fix"
description: "Fix keyboard shortcuts when terminal focused + add active terminal highlight"
status: completed
priority: P2
effort: 1.5h
branch: beta
tags: [keyboard, terminal, xterm, ux]
created: 2026-01-09
---

# Keyboard Shortcuts Fix

## Problem Statement
1. `Ctrl+N` không hoạt động khi terminal focus (xterm bắt event trước)
2. `Alt+1~9` switch project không hoạt động khi terminal focus
3. Active terminal không đủ nổi bật so với inactive terminals
4. Cần thêm `Ctrl+T` như phím tắt alternative cho New Terminal

## Root Cause
xterm.js `attachCustomKeyEventHandler` chỉ xử lý `Ctrl+V`. Các phím khác return `true` → xterm tiếp tục xử lý → window listener không nhận được.

## Solution Overview
1. Intercept global shortcuts trong xterm key handler
2. Add Ctrl+T support
3. Enhance active terminal styling với glow effect + animation

## Implementation Phases

| Phase | Description | Status | Effort |
|-------|-------------|--------|--------|
| [Phase 1](./phase-01-xterm-shortcut-intercept.md) | Intercept shortcuts trong xterm | ✅ DONE 2026-01-09 | 45m |
| [Phase 2](./phase-02-active-terminal-styling.md) | Glow effect + animation cho active terminal | ✅ DONE 2026-01-09 | 30m |
| [Phase 3](./phase-03-readme-update.md) | Update README keyboard shortcuts | ✅ DONE 2026-01-09 | 15m |

## Files to Modify
- `src/renderer/hooks/use-terminal.ts` - xterm key handler
- `src/renderer/hooks/use-keyboard-shortcuts.ts` - Ctrl+T
- `src/renderer/styles/globals.css` - active terminal styling
- `README.md` - keyboard shortcuts section

## Related Reports
- [Brainstorm Report](../reports/brainstorm-260109-0900-keyboard-shortcuts-fix.md)

## Success Criteria
- [x] Ctrl+N creates terminal when terminal focused
- [x] Ctrl+T creates terminal (new shortcut)
- [x] Alt+1~9 switches project when terminal focused
- [x] Ctrl+W closes terminal when focused
- [x] Active terminal has visible glow effect
- [x] Animation plays when switching terminals
- [x] Inactive terminals dimmed to 0.85 opacity
