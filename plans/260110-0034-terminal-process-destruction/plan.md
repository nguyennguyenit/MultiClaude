---
title: "Robust Terminal Process Destruction"
description: "Implement cross-platform async terminal destruction with timeout and force kill"
status: completed
priority: P2
effort: 2h
branch: beta
tags: [terminal, backend, refactor]
created: 2026-01-10
---

# Robust Terminal Process Destruction

## Overview

Current `destroy()` and `destroyAll()` methods in terminal-manager.ts have cross-platform issues:
1. `destroy()` only calls `pty.kill()`, doesn't wait for process exit
2. `destroyAll()` loops through destroy, no force kill mechanism
3. Windows: SIGTERM equivalent doesn't kill cmd/powershell subprocess tree

## Solution

Implement async destruction with graceful-first approach + platform-specific force kill fallback.

## Phases

| # | Phase | Status | Effort | Link |
|---|-------|--------|--------|------|
| 1 | Core Implementation | Done | 1h | [phase-01](./phase-01-core-implementation.md) |
| 2 | Integration & Testing | Done | 1h | [phase-02-integration-testing.md](./phase-02-integration-testing.md) |

## Dependencies

- `@lydell/node-pty` - PTY process management
- `child_process.execSync` - Windows taskkill command

## Key Files

- `src/main/terminal/terminal-manager.ts` - Core changes
- `src/main/index.ts` - App quit handler update
- `src/main/ipc/handlers.ts` - IPC handler update
- `src/main/terminal/__tests__/terminal-manager.spec.ts` - Tests

## Risk Assessment

| Risk | Mitigation |
|------|------------|
| Breaking existing callers | Keep sync methods, add async variants |
| Windows taskkill failure | Silent catch, process may already be dead |
| Race conditions | Proper cleanup in onExit handler |
