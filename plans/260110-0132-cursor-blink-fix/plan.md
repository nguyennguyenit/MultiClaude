---
title: "Fix Cursor Blink Bug on Project Switch"
description: "Auto-activate first terminal when switching projects to fix cursor blink rendering"
status: done
priority: P1
effort: 2h
branch: beta
tags: [bugfix, terminal, ui, xterm]
created: 2026-01-10
---

# Fix Cursor Blink Bug on Project Switch

## Problem Summary

Cursor blinking displays incorrectly across all terminals when switching projects. Root cause: `activeTerminalId` NOT reset when switching projects, causing all terminals to have `isActive={false}`, and `focus()` never called.

## Root Cause Chain

```
activeTerminalId NOT reset → stale ID from old project
    → NO terminal matches in new project
    → ALL terminals: isActive={false}
    → focus() NEVER called
    → xterm.js cursor only blinks when focused
    → CURSOR BUG
```

## Selected Solution

**Solution 2: Auto-activate First Terminal** - Modify `handleSelectProject` in App.tsx to auto-select first terminal of new project after `setActiveProject(id)`.

## Key Files

| File | Purpose |
|------|---------|
| `src/renderer/App.tsx:72-109` | handleSelectProject - add terminal selection |
| `src/renderer/stores/app-store.ts:65` | setActiveTerminal function reference |
| `src/renderer/stores/app-store.ts:103` | setActiveProject (current - no reset) |

## Implementation Phases

| Phase | Description | Effort | File | Status |
|-------|-------------|--------|------|--------|
| 1 | Modify handleSelectProject | 1h | `phase-1-implementation.md` | DONE (2026-01-10) |
| 2 | Testing & Verification | 1h | `phase-2-testing.md` | DONE (2026-01-10) |

## Success Criteria

- [x] First terminal of new project has `isActive={true}`
- [x] `focus()` called automatically after project switch
- [x] Cursor blinks correctly in all terminals
- [x] Empty project switch sets `activeTerminalId=null`
- [x] No visual glitches during transition
- [x] Rapid project switching works correctly

## Related Reports

- Root cause analysis: `plans/reports/brainstorm-260110-0117-cursor-blink-project-switch-bug.md`
- Evidence proof: `plans/reports/proof-260110-0127-cursor-blink-root-cause-evidence.md`
- Test scenarios: `plans/reports/verification-260110-0127-cursor-bug-test-plan.md`

## Constraints

- Keep existing transition state mechanism (`projectSwitching`)
- Keep disposal delay (TERMINAL_DISPOSE_DELAY + 50ms)
- Keep folder validation logic
- No debug logs in final implementation
- Follow YAGNI, KISS, DRY principles
