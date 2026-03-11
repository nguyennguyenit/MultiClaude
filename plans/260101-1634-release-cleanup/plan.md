---
title: "Phase 1: Code Cleanup for Release Readiness"
description: "Clean git history, setup testing framework, and prepare codebase for public release"
status: completed
priority: P1
effort: 6.5h
issue: null
branch: master
tags: [cleanup, testing, release, infra]
created: 2026-01-01
---

# Phase 1: Code Cleanup for Release Readiness

## Overview

Prepare MultiClaude for public release by cleaning uncommitted changes, setting up testing infrastructure, and ensuring code quality.

**Context:** [Brainstorm Report](../reports/brainstorm-260101-1634-release-readiness.md)

## Phases

| # | Phase | Status | Effort | Link |
|---|-------|--------|--------|------|
| 1 | Update .gitignore | DONE (2026-01-03) | 15m | [phase-01](./phase-01-update-gitignore.md) |
| 2 | Review & Commit Changes | DONE (2026-01-03) | 1.5h | [phase-02](./phase-02-commit-changes.md) |
| 3 | Setup Vitest | DONE (2026-01-03) | 1h | [phase-03](./phase-03-setup-vitest.md) |
| 4 | Write Core Module Tests | DONE (2026-01-03) | 3h | [phase-04](./phase-04-write-tests.md) |
| 5 | Final Cleanup | DONE (2026-01-03) | 30m | [phase-05](./phase-05-final-cleanup.md) |

## Dependencies

- Node.js 18+ installed
- Git configured
- Current uncommitted changes are valid (not breaking)

## Core Modules to Test

| Module | File | Priority | Testability |
|--------|------|----------|-------------|
| TerminalManager | `src/main/terminal/terminal-manager.ts` | High | Medium (requires mocking node-pty) |
| GitManager | `src/main/git/git-manager.ts` | High | High (can mock simple-git) |
| ProjectStore | `src/main/project/project-store.ts` | High | High (can mock electron-store) |

## Success Criteria

- [x] All changes committed with clean history
- [x] `new-feature/` and `repomix-output.xml` in .gitignore
- [x] Vitest configured and working
- [x] >60% coverage on core modules
- [x] `npm run test` passes
- [x] `npm run build` still works

## Risks

| Risk | Mitigation |
|------|------------|
| node-pty hard to mock | Use integration tests with real PTY or skip PTY-specific tests |
| electron-store requires Electron context | Mock the store entirely |
| simple-git async complexity | Use vi.mock() with manual mocks |
