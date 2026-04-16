---
date: 2026-04-13
type: planning
status: complete
---

# Terminal Output Pipeline Plan

## Context

Created a deep TDD plan for renderer performance work on B1 + B2:

- move renderer terminal output buffering out of reactive Zustand state
- replace per-terminal IPC output listeners with one global App listener + imperative dispatcher

## What Happened

- scanned unfinished plans in `plans/`
- found no hard blocker or bidirectional dependency strong enough to encode
- verified current hot paths in `app-store.ts`, `terminal-view.tsx`, `App.tsx`
- wrote plan folder `plans/260413-1812-optimize-terminal-output-buffer-and-ipc-dispatch/`

## Decisions

- keep the store facade API stable: `appendOutput()` and `getTerminalOutput()`
- extract a dedicated buffer module for non-reactive renderer state
- extract a dedicated dispatcher module instead of growing `App.tsx`
- use pure module tests as the main TDD net because Vitest runs in `node` env

## Next

- execute Phase 1 first
- verify tests fail before implementation
- profile again after B1+B2 before opening B3/B4 follow-up work

## Unresolved Questions

- none blocking
