---
title: "Fix cursor display on project switch"
description: "Resolve cursor not appearing when switching between projects due to race conditions and missing focus triggers"
status: completed
priority: P0
effort: 4h
branch: beta
tags: [bugfix, terminal, xterm, cursor, focus]
created: 2026-01-14
completed: 2026-01-15
---

# Cursor Display Fix on Project Switch

## Problem
Cursor not displaying correctly when switching between projects. Affects multi-project workflows (A->B->C->A pattern).

## Root Causes
1. **Non-atomic state update**: `setActiveProject` + `setActiveTerminal` = 2 separate calls, intermediate state possible
2. **Missing focus trigger**: `isActive` only triggers focus on `false->true`, but terminal stays mounted
3. **Race condition**: `focus()` called before WebGL addon loaded (50ms debounce)
4. **Hidden/display mismatch**: `hidden` prop has 2 conditions, CSS only checks project active

## Solution Overview
| Phase | Description | Priority | Effort |
|-------|-------------|----------|--------|
| 1 | Atomic state update | P0 | 1h |
| 2 | Hidden->visible focus trigger | P1 | 1h |
| 3 | WebGL-aware focus | P2 | 1h |
| 4 | E2E test coverage | P2 | 1h |

## Phase Files
- [Phase 1: Atomic State Update](./phase-01-atomic-state-update.md)
- [Phase 2: Visibility Focus Trigger](./phase-02-visibility-focus-trigger.md)
- [Phase 3: WebGL-Aware Focus](./phase-03-webgl-aware-focus.md)
- [Phase 4: E2E Tests](./phase-04-e2e-tests.md)

## Research Reports
- [xterm.js Focus/Cursor Behavior](./research/researcher-01-xterm-focus.md)
- [Zustand State Batching](./research/researcher-02-zustand-batching.md)
- [Root Cause Analysis](../reports/brainstorm-260114-2156-cursor-display-project-switch.md)

## Success Criteria
- [x] Cursor visible after A->B switch
- [x] Cursor visible after A->B->C->A switch (3+ projects)
- [x] Cursor visible when switching terminals within same project
- [x] No visible flicker or delay
- [x] E2E tests pass for multi-project switching

## Dependencies
- None (isolated to terminal/state management)

## Risk
- Low: Changes are additive, existing behavior preserved as fallback
- Mitigation: Each phase independently testable

## Validation Summary

**Validated:** 2026-01-14
**Questions asked:** 5

### Confirmed Decisions
| Decision | Choice |
|----------|--------|
| Phase 1: API compatibility | Keep both `switchToProject` (new) + `setActiveProject` (legacy) |
| Phase 2+3: Focus timing | 60ms delay (WEBGL_TOGGLE_DEBOUNCE + 10ms buffer) |
| Phase 4: E2E scope | Project switch only (A→B→A, A→B→C→A patterns) |
| Fallback mechanism | ANSI cursor show (`\x1b[?25h`) before focus |
| User typing behavior | Focus immediately + 100ms debounce for intermediate keystrokes |

### Action Items
- [x] Plan validated, ready for implementation
