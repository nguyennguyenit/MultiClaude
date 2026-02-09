---
title: "Release Beta Slash Command"
description: "Create /release:beta command for auto-bumping beta versions"
status: completed
priority: P3
effort: 30m
branch: beta
tags: [slash-command, versioning, release]
created: 2026-01-08
completed: 2026-01-09
---

# Release Beta Slash Command

## Overview

Create `/release:beta` slash command at `~/.claude/commands/release/beta.md` that auto-detects version from package.json and bumps beta version appropriately.

## Version Logic

| Current | New |
|---------|-----|
| `1.1.5` (stable) | `1.1.6-beta.1` |
| `1.1.6-beta.1` | `1.1.6-beta.2` |
| `1.1.6-beta.9` | `1.1.6-beta.10` |

## Workflow

```
Validate → Bump → Commit → Tag → Push
```

## Implementation Phases

| Phase | Description | Status | Progress |
|-------|-------------|--------|----------|
| [Phase 01](./phase-01-create-command.md) | Create beta.md command file | DONE ✓ 2026-01-09 | 100% |

## References

- Brainstorm: [brainstorm-260108-2308-release-beta-command.md](./reports/brainstorm-260108-2308-release-beta-command.md)

## Success Criteria

- [x] Command file created at `~/.claude/commands/release/beta.md`
- [x] Auto-detects stable vs beta version
- [x] Correctly bumps beta number
- [x] Creates git tag `v{version}`
- [x] Pushes to origin with tags

## Notes

- Single-file implementation (no scripts needed)
- Uses npm/git bash commands directly
- No arguments required - fully automatic
