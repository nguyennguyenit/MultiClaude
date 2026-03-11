---
title: "Terminal File Drop"
description: "Drag-drop files into terminal to insert file paths as text"
status: done
priority: P2
effort: 2h
issue: null
branch: master
tags: [feature, frontend, terminal, ux]
created: 2026-01-01
---

# Terminal File Drop

## Overview

Add drag-and-drop support for files into the terminal. When files are dropped, their paths are inserted as text input to the PTY.

## Context

- Brainstorm report: `../reports/brainstorm-260101-1653-file-drop-terminal.md`

## Phases

| # | Phase | Status | Effort | Link |
|---|-------|--------|--------|------|
| 1 | File Drop Hook & Integration | Done | 2h | [phase-01](./phase-01-file-drop-hook.md) |

## Dependencies

- None - uses existing Electron drag-drop APIs

## Success Criteria

- [x] Single file drop inserts path correctly
- [x] Multiple files separated by newlines
- [x] Paths with spaces are quoted
- [x] Visual feedback on drag over
- [x] Works in both dark and light themes

## Future Enhancements

- Paste screenshot from clipboard (auto-save to temp, insert path)
