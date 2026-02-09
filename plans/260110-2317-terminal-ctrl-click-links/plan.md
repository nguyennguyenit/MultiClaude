---
title: "Terminal Ctrl+Click Links"
description: "Add Ctrl+Click to open URLs in system browser"
status: pending
priority: P2
effort: 30m
branch: beta
tags: [terminal, xterm, links, ux]
created: 2026-01-10
---

# Terminal Ctrl+Click Links

## Overview

Enable Ctrl+Click (Cmd+Click on macOS) to open URLs displayed in terminal in system default browser. Uses `@xterm/addon-web-links` already installed.

## Phases

| Phase | Description | Status |
|-------|-------------|--------|
| [Phase 01](./phase-01-web-links-addon.md) | Load WebLinksAddon with Ctrl+Click handler | ✅ Done |

## Key Decisions

- **Approach**: Use existing `@xterm/addon-web-links@0.12.0` package
- **IPC**: Reuse existing `app.openExternal` (already has `shell.openExternal`)
- **Trigger**: Only on Ctrl+Click / Cmd+Click (not plain click)
- **Security**: Add URL protocol validation (http/https only)

## Context

- [Brainstorm Report](../reports/brainstorm-260110-2317-terminal-ctrl-click-links.md)
- [use-terminal.ts](../../src/renderer/hooks/use-terminal.ts) - Target file

## Dependencies

- `@xterm/addon-web-links@0.12.0` (already installed)
- `window.electron.app.openExternal()` (already exists)
