---
title: "Release Changelog AI Rewrite"
description: "Modify /release:beta and /release:stable to generate categorized, AI-rewritten changelogs"
status: in-progress
priority: P1
effort: 3h
branch: beta
tags: [release-management, changelog, ai, automation]
created: 2026-01-10
---

# Release Changelog AI Rewrite

## Overview

Enhance the release-management skill to generate professional changelogs by:
1. Parsing Conventional Commits from git log
2. Using Claude AI to rewrite entries into concise, user-facing descriptions
3. Outputting to both GitHub Release Notes and `./CHANGELOG.md`

## Context

- **Brainstorm:** [brainstorm-260110-1735-release-changelog-ai-rewrite.md](../reports/brainstorm-260110-1735-release-changelog-ai-rewrite.md)
- **Research 1:** [researcher-01-ai-changelog.md](./research/researcher-01-ai-changelog.md)
- **Research 2:** [researcher-02-conventional-commits.md](./research/researcher-02-conventional-commits.md)

## Category Mapping

| Commit Type | Changelog Section |
|-------------|-------------------|
| `feat:` | New Features |
| `fix:` | Bug Fixes |
| `perf:`, `improvement:` | Improvements |
| `docs:` | Documentation |
| `refactor:` | Refactor |
| `chore:`, `ci:`, `build:`, `test:`, `style:` | *(Ignored)* |

## Phases

| # | Phase | Status | Effort | Link |
|---|-------|--------|--------|------|
| 1 | Parse Commits Script | Done (2026-01-10) | 45m | [phase-01](./phase-01-parse-commits-script.md) |
| 2 | SKILL.md Changelog Flow | Done (2026-01-11) | 1h | [phase-02](./phase-02-skill-md-update.md) |
| 3 | Command Updates | Pending | 30m | [phase-03](./phase-03-command-updates.md) |
| 4 | Testing & Validation | Pending | 45m | [phase-04](./phase-04-testing.md) |

## Dependencies

- Existing `~/.claude/skills/release-management/` structure
- Claude AI access for changelog rewriting
- Project uses Conventional Commits format

## Success Criteria

- [x] Commits parsed and categorized correctly
- [x] AI rewrites are concise and meaningful
- [x] GitHub draft release uses new format
- [x] CHANGELOG.md prepended with new version
- [ ] No regression in current release workflow
- [x] Dry-run mode shows preview of changelog

---

## Validation Summary

**Validated:** 2026-01-10
**Questions asked:** 6

### Confirmed Decisions

| Decision | User Choice |
|----------|-------------|
| Breaking changes display | Inline prefix (`**BREAKING:** message`) |
| AI fallback behavior | Fallback to raw commits if AI fails |
| CHANGELOG.md commit | Include in release commit |
| Commit limit (no tag) | 20 commits |
| Scope display format | Bold prefix (`**Terminal:** message`) |
| GitHub vs CHANGELOG format | Same format for both |

### Action Items

- [x] Update Phase 1: Add breaking change prefix to output format
- [x] Update Phase 2: Add fallback logic if AI rewrite fails
- [x] Update Phase 2: Stage CHANGELOG.md in release commit
- [x] Update Phase 2: Use bold scope prefix in AI prompt template
