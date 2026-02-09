---
title: "Responsive Scroll Button"
description: "Scale scroll-to-bottom button size based on terminal container width using CSS Container Queries"
status: done
priority: P3
effort: 30m
branch: beta
tags: [frontend, terminal, css, ux]
created: 2026-01-07
---

# Responsive Scroll Button

## Overview

Implement responsive sizing for scroll-to-bottom button in terminal view. Button scales 3-4% of terminal width, bounded 20-32px.

## Context

- Brainstorm: [brainstorm-260107-0000-responsive-scroll-button.md](../reports/brainstorm-260107-0000-responsive-scroll-button.md)
- Target file: `src/renderer/components/terminal/terminal-view.tsx`

## Solution

**CSS Container Queries** with `clamp()` and `cqw` (container query width) units.

- Add `container-type: size` to wrapper
- Replace fixed Tailwind classes with inline `clamp()` styles
- Zero JS overhead, pure CSS solution

## Phases

| # | Phase | Status | Effort | Link |
|---|-------|--------|--------|------|
| 1 | Implementation | Done | 20m | [phase-01](./phase-01-implementation.md) |
| 2 | Testing | Done | 10m | [phase-02](./phase-02-testing.md) |

## Dependencies

- Electron 33 (Chromium 128) - container queries supported
- No npm dependencies needed

## Success Criteria

- Button scales smoothly 20-32px based on terminal width
- Works across 1x1, 2x2, 3x4 grid layouts
- No layout shift or jank during resize
