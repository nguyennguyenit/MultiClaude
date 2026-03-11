---
title: "Terminal Smart Scroll"
description: "Auto-scroll to bottom if already at bottom, preserve position if user scrolled up, floating scroll-to-bottom button"
status: completed
priority: P2
effort: 1.5h
branch: feature/terminal-rendering-mode
tags: [frontend, terminal, ux]
created: 2026-01-06
---

# Terminal Smart Scroll

## Overview

Implement smart scroll behavior for terminal: auto-scroll to bottom during output if already at bottom, but preserve scroll position if user has scrolled up to read previous output. Include floating "scroll to bottom" button that appears when user scrolls up.

## Problem

When Claude finishes generating long output and displays Yes/No prompt, terminal scrolls UP instead of staying at bottom, making it difficult to interact with the prompt.

## Solution

1. Track viewport position using xterm.js `onScroll` event
2. Conditionally call `scrollToBottom()` only when user was at bottom
3. Add floating button at bottom-right corner, visible only when scrolled up

## Phases

| # | Phase | Status | Effort | Link |
|---|-------|--------|--------|------|
| 1 | Implement Smart Scroll | Complete | 30m | [phase-01](./phase-01-implement-smart-scroll.md) |
| 2 | Add Scroll-to-Bottom Button | Complete | 30m | [phase-02](./phase-02-scroll-to-bottom-button.md) |
| 3 | Testing & Validation | Complete | 30m | [phase-03](./phase-03-testing-validation.md) |

## Dependencies

- xterm.js `buffer.viewportY` and `buffer.baseY` APIs
- `terminal.onScroll()` event listener
- `terminal.scrollToBottom()` method

## Related Files

- `src/renderer/hooks/use-terminal.ts` - Smart scroll logic
- `src/renderer/components/terminal/terminal-view.tsx` - Floating button UI

## Brainstorm Reference

- [brainstorm-260106-1019-terminal-smart-scroll.md](../reports/brainstorm-260106-1019-terminal-smart-scroll.md)
