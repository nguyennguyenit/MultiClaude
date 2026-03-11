---
title: "Terminal Hanging Hybrid Fix"
description: "Fix terminal hanging when switching projects by using CSS visibility instead of unmount"
status: in_progress
priority: P1
effort: 4h
branch: master
tags: [bugfix, terminal, renderer]
created: 2026-01-09
updated: 2026-01-11
---

# Terminal Hanging Hybrid Fix

## Overview

Fix terminal "hanging" issue where Claude CLI gets stuck on "Reviewing code..." after switching projects. Root cause: terminals unmount when switching projects, causing xterm.js disposal while PTY continues running. When switching back, new xterm instance has state mismatch → ESC doesn't work, output may be lost.

**Solution:** Hybrid approach - CSS visibility hide instead of unmount, with WebGL disabled for hidden terminals.

## Context

- **Root Cause Analysis:** [brainstorm report](../reports/brainstorm-260109-1909-terminal-hanging-rootcause.md)
- **Primary Issue Location:** `App.tsx:49-51` - filter causes terminal unmount

## Phases

| # | Phase | Status | Effort | Link |
|---|-------|--------|--------|------|
| 1 | Core CSS Visibility Fix | Done (2026-01-11) | 2-3h | [phase-01](./phase-01-core-css-visibility-fix.md) |
| 2 | Output Throttling (Optional) | Pending | 2-3h | [phase-02-output-throttling.md](./phase-02-output-throttling.md) |

## Success Metrics

| Metric | Current | Target |
|--------|---------|--------|
| ESC success after switch | ~50% | 95%+ |
| Output lost on switch | Possible | None |
| Terminal stuck | Possible | None |

## Testing Checklist

- [x] Switch projects rapidly, verify no crash
- [x] Run Claude in terminal, switch away, switch back - ESC should work
- [x] Check scrollback preserved after switch
- [x] Verify WebGL toggle works in all 3 modes (Performance, Balanced, Quality)
- [x] Memory usage with 9+ terminals
- [x] CPU usage with hidden terminals
- [x] 146/146 unit tests passing
- [x] Project deletion cleans up all associated terminals

## Dependencies

- xterm.js WebGL addon behavior with `display: none`
- Zustand state management unchanged
