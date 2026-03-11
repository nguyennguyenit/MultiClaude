---
title: "SSH Support Feature"
description: "Add SSH terminal support for remote Claude Code sessions and server management"
status: pending
priority: P1
effort: 16h
branch: beta
tags: [ssh, terminal, remote, feature]
created: 2026-01-08
---

# SSH Support Implementation Plan

## Overview

Add SSH terminal capabilities to MultiClaude, enabling users to run Claude Code on remote servers and manage infrastructure through SSH connections.

## Goals

1. **Remote Claude Code**: Run Claude Code sessions on remote servers via SSH
2. **Server Management**: DevOps, logs, deployment tasks from MultiClaude
3. **Config Integration**: Import hosts from ~/.ssh/config

## Architecture Decision

**Option C: Extend Existing TerminalManager** (Selected)
- Minimal refactor, single source of truth
- Add SSH connection methods alongside PTY methods
- Unified event emission (output, exit, titleChange)

## Implementation Phases

| Phase | Name | Status | Effort | Description |
|-------|------|--------|--------|-------------|
| 1 | [Types & IPC Channels](./phase-01-types-ipc-channels.md) | pending | 2h | SSH types, IPC channel definitions |
| 2 | [SSH Core Infrastructure](./phase-02-ssh-core-infrastructure.md) | pending | 4h | ssh2 wrapper, config parser, profile store |
| 3 | [Terminal Manager Extension](./phase-03-terminal-manager-extension.md) | pending | 3h | Extend TerminalManager with SSH methods |
| 4 | [IPC Handlers & Preload](./phase-04-ipc-handlers-preload.md) | pending | 2h | Register handlers, expose API to renderer |
| 5 | [Renderer UI Components](./phase-05-renderer-ui-components.md) | pending | 4h | Quick Connect, SSH modal, terminal badges |
| 6 | [Polish & Testing](./phase-06-polish-testing.md) | pending | 1h | Error handling, reconnection, tests |

## Dependencies

```json
{
  "ssh2": "^1.16.0",
  "ssh-config": "^5.0.0"
}
```

Note: chokidar already in project.

## Key Files

### New Files
- `src/main/ssh/ssh-connection.ts` - ssh2 wrapper class
- `src/main/ssh/ssh-config-watcher.ts` - Parse & watch ~/.ssh/config
- `src/main/ssh/ssh-profile-store.ts` - electron-store for custom profiles
- `src/main/ssh/ssh-auth-handler.ts` - Auth flow logic
- `src/renderer/components/ssh/ssh-quick-connect.tsx` - Quick Connect dropdown
- `src/renderer/components/ssh/ssh-connection-modal.tsx` - New connection form

### Modified Files
- `src/shared/types/index.ts` - SSH types
- `src/shared/constants/ipc-channels.ts` - SSH channels
- `src/main/terminal/terminal-manager.ts` - SSH methods
- `src/main/ipc/handlers.ts` - SSH handlers
- `src/preload/index.ts` - SSH API
- `src/renderer/components/terminal/terminal-pane.tsx` - SSH badge
- `src/renderer/stores/app-store.ts` - SSH profile state

## Out of Scope (v1)

- SFTP file transfer
- SSH tunneling / port forwarding
- SSH key management (generate, upload)

---

## Validation Summary

**Validated:** 2026-01-08
**Questions asked:** 7

### Confirmed Decisions

| Decision | User Choice |
|----------|-------------|
| Architecture | Option C: Extend existing TerminalManager ✓ |
| Auth flow | Agent → Key → Password (cascade) |
| Password storage | Optional encrypted storage (safeStorage with consent) |
| UI placement | **Sidebar section** (changed from tab bar) |
| Config watching | File watcher with auto-refresh ✓ |
| Host key verification | **Prompt on unknown/changed** (added to scope) |
| Jump host support | **Added to v1 scope** |

### Plan Revisions Required

1. **Phase 2**: Add host key verification to SSHConnection
   - Store known hosts in electron-store
   - Prompt user via IPC when host key unknown or changed
   - Add `SSH_HOST_KEY_PROMPT` IPC channel

2. **Phase 2**: Add optional password storage
   - Use Electron safeStorage (already in project for notifications)
   - Add "Remember password" checkbox in connection modal
   - Clear stored password on user request

3. **Phase 2**: Add jump host support
   - Parse ProxyJump from ~/.ssh/config
   - Implement nested connection for bastion hosts
   - **Effort impact**: +2h to Phase 2

4. **Phase 5**: Move UI to sidebar
   - Create SSH section in sidebar (like Git panel)
   - Remove tab bar dropdown approach
   - May reuse sidebar patterns from git-panel

### Updated Effort Estimate

| Phase | Original | Revised |
|-------|----------|---------|
| Phase 2 | 4h | 6h (+2h for host key, jump host) |
| Phase 5 | 4h | 4h (sidebar similar effort) |
| **Total** | **16h** | **18h**

## Research

- [ssh2 Library](./research/researcher-01-ssh2-library.md)
- [SSH Config Parsing](./research/researcher-02-ssh-config-parsing.md)

## References

- [Brainstorm Report](../reports/brainstorm-260108-1420-ssh-support-feature.md)
