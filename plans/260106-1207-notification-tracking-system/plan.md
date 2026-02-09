---
title: "Enhanced Notification Tracking System"
description: "Implement dual-mode parser with task name extraction, unique ID deduplication, and background-only notifications"
status: completed
priority: P2
effort: 6h
branch: feature/terminal-rendering-mode
tags: [notification, backend, feature]
created: 2026-01-06
---

# Enhanced Notification Tracking System

## Overview

Replace simple regex pattern detection with a dual-mode parser architecture that accurately extracts task names, prevents duplicate notifications via unique task IDs, and only notifies when app/terminal is in background.

## Problem Statement

Current limitations:
1. No task name extraction - only generic "Task completed" messages
2. Limited detection - exit codes not captured from PTY events
3. Spam potential - time-based debounce allows repeated notifications
4. No focus awareness - notifies even when user is watching terminal

## Solution

**Approach A2: Dual-mode Parser** (selected from brainstorm)
- JSON stream parser for `--output-format=stream-json` mode
- Enhanced plain text parser as fallback
- Unique task ID deduplication via SHA256 hash
- Background-only notifications via window/tab focus detection

## Phases

| # | Phase | Status | Effort | Link |
|---|-------|--------|--------|------|
| 1 | Types & Constants | Done | 30m | [phase-01](./phase-01-types-constants.md) |
| 2 | Output Parser Infrastructure | Done | 1h | [phase-02](./phase-02-output-parser.md) |
| 3 | Focus Detection & Dedup | Done | 1h | [phase-03](./phase-03-focus-dedup.md) |
| 4 | NotificationManager Integration | Done | 1.5h | [phase-04](./phase-04-integration.md) |
| 5 | Rich Platform Messages | Done | 1h | [phase-05](./phase-05-rich-messages.md) |
| 6 | Settings UI | Done | 1h | [phase-06](./phase-06-settings-ui.md) |

## Architecture

```
TerminalManager.onData
        │
        ▼
┌───────────────────────────────────────────┐
│            OutputParser (Router)           │
│  ┌─────────────────┐ ┌──────────────────┐ │
│  │JsonStreamParser │ │PlainTextParser   │ │
│  │(--stream-json)  │ │(Enhanced regex)  │ │
│  └────────┬────────┘ └────────┬─────────┘ │
│           └────────┬──────────┘           │
│                    ▼                      │
│         ┌───────────────────┐             │
│         │ TaskEventEmitter  │             │
│         └─────────┬─────────┘             │
└───────────────────┼───────────────────────┘
                    ▼
┌───────────────────────────────────────────┐
│      NotificationManager (Enhanced)        │
│  ┌─────────────────────────────────────┐  │
│  │ TaskTracker (unique ID dedup)       │  │
│  │ FocusDetector (window + tab)        │  │
│  └─────────────────────────────────────┘  │
│  ┌──────────┐ ┌──────────┐ ┌───────────┐  │
│  │ Native   │ │ Telegram │ │ Discord   │  │
│  │ Notif    │ │ (HTML)   │ │ (Embed)   │  │
│  └──────────┘ └──────────┘ └───────────┘  │
└───────────────────────────────────────────┘
```

## New Files (6)

| File | Purpose |
|------|---------|
| `src/main/notification/output-parser.ts` | Route between JSON/text parsers |
| `src/main/notification/json-stream-parser.ts` | Parse Claude Code stream-json format |
| `src/main/notification/plain-text-parser.ts` | Enhanced regex with capture groups |
| `src/main/notification/task-tracker.ts` | Unique task ID deduplication |
| `src/main/notification/focus-detector.ts` | Window + tab focus detection |
| `src/shared/types/notification-events.ts` | TaskEvent interface, event mappings |

## Modified Files (7)

| File | Changes |
|------|---------|
| `src/main/terminal/terminal-manager.ts` | Add stream-json option |
| `src/main/notification/notification-manager.ts` | Integrate TaskTracker, FocusDetector |
| `src/main/notification/discord-notifier.ts` | Rich embed format |
| `src/main/ipc/handlers.ts` | New IPC handlers for settings |
| `src/shared/constants/notification.ts` | Enhanced patterns |
| `src/shared/types/notification.ts` | New settings fields |
| `src/renderer/components/settings/notification-settings.tsx` | New UI toggles |

## Dependencies

- Claude Code CLI with `--output-format=stream-json` support
- Existing NotificationManager architecture
- Node.js crypto module (built-in)

## Research

- [Claude Code JSON Stream Format](./research/researcher-01-claude-code-json-stream.md)
- [Focus Detection & Deduplication](./research/researcher-02-focus-detection-dedup.md)

## Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| JSON stream changes output appearance | Medium | Make optional, default 'auto' |
| PTY exit code fires on shell commands | Low | Only track when `isClaudeMode=true` |
| Regex false positives | Medium | Use JSON stream primary, text fallback |
| Performance with frequent parsing | Low | Debounce at parser level |

## Success Criteria

- [x] Task names correctly extracted in 95%+ cases with stream-json
- [x] Task names correctly extracted in 80%+ cases with plain text
- [x] Zero duplicate notifications for same task
- [x] Notifications only appear when app/terminal unfocused
- [x] Telegram/Discord messages contain all required info

---

## Validation Summary

**Validated:** 2026-01-06
**Questions asked:** 7

### Confirmed Decisions

| Decision | User Choice |
|----------|-------------|
| JSON stream schema uncertainty | Proceed with inferred schema, fix issues as discovered |
| TaskTracker dedup TTL | 5 minutes (as planned) |
| PatternDetector deprecation | Keep exported but deprecated |
| PTY exit code tracking | Skip for this implementation |
| Linux/Wayland focus limitation | Accept limitation, users can disable setting |
| Auto-detection mode behavior | **Lock after first detection** (change from per-chunk) |
| Implementation scope | All 6 phases |

### Action Items

- [x] **Phase 2 update needed:** Modify OutputParser auto-detection to lock terminal to detected parser type after first successful detection (prevents mid-stream parser switching)
