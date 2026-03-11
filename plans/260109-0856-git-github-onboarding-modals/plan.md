---
title: "Git/GitHub Onboarding Modals"
description: "Modal prompts for Git init and GitHub connection when adding projects"
status: pending
priority: P2
effort: 16h
branch: beta
tags: [git, github, modals, ux, onboarding]
created: 2026-01-09
---

# Git/GitHub Onboarding Modals

## Overview

Two modal workflows to guide users through Git initialization and GitHub connection when adding new projects:

1. **Git Init Modal** - Prompts when adding folder without `.git` directory
2. **GitHub Connection Modal** - Guides connecting local repo to GitHub (create/link)

## Architecture

```
User adds project folder
        |
        v
  [Check .git exists?]
        |
    No  |  Yes
        v    \
[Git Init Modal] --> [Project Added]
        |                  |
   Init Git?          [Check remote?]
        |                  |
    Yes |              No  |  Yes
        v                  v    \
   [git init] --> [GitHub Modal] --> Done
                        |
              Create/Link Repo?
                        |
                   [gh repo create]
                   or [git remote add]
                        |
                   [Auto-push]
```

## Phases

| # | Phase | Status | Effort | File |
|---|-------|--------|--------|------|
| 1 | Types & IPC Channels | pending | 1h | [phase-01](./phase-01-types-ipc-channels.md) |
| 2 | Git Init Modal Component | pending | 2h | [phase-02](./phase-02-git-init-modal-component.md) |
| 3 | App Integration (Git Init) | pending | 1.5h | [phase-03](./phase-03-app-integration-git-init.md) |
| 4 | GitHub Auth Handlers | pending | 2h | [phase-04](./phase-04-github-auth-handlers.md) |
| 5 | GitHub Modal Component | pending | 4h | [phase-05](./phase-05-github-modal-component.md) |
| 6 | GitHub Modal Integration | pending | 2h | [phase-06](./phase-06-github-modal-integration.md) |
| 7 | Testing & Polish | pending | 3.5h | [phase-07](./phase-07-testing-polish.md) |

## Success Criteria

- [ ] Git Init Modal appears for folders without `.git`
- [ ] Modal skipped for existing repos or dismissed projects
- [ ] Git initialized successfully on click
- [ ] GitHub Modal appears after Git init (if no remote)
- [ ] Auth step skipped if already authenticated
- [ ] Create repo works with public/private toggle
- [ ] Link existing repo works with validation
- [ ] Auto-push after successful connection
- [ ] "Don't ask again" persists across restarts

## Key Files

**New Components:**
- `src/renderer/components/git-init-modal/git-init-modal.tsx`
- `src/renderer/components/github-connection-modal/github-connection-modal.tsx`
- `src/renderer/components/github-connection-modal/auth-step.tsx`
- `src/renderer/components/github-connection-modal/configure-step.tsx`

**New Backend:**
- `src/main/ipc/github-auth-handlers.ts`

**Modified:**
- `src/shared/types/index.ts` - Project interface extensions
- `src/renderer/stores/app-store.ts` - Modal state
- `src/renderer/App.tsx` - Integration with handleAddProject
- `src/renderer/components/git-panel/git-panel.tsx` - Push trigger

## Dependencies

- `simple-git` (existing) - Git operations
- `gh` CLI - GitHub authentication and repo creation
- Existing IPC infrastructure

## Validation Summary

**Validated:** 2026-01-09
**Questions asked:** 7

### Confirmed Decisions

| Decision | User Choice |
|----------|-------------|
| Modal state location | Inline in app-store (recommended) |
| Repo validation method | Client-side fetch to api.github.com |
| gh CLI missing handling | Error toast + allow skip |
| OAuth timeout | 5 min timeout + retry button |
| Auto-push behavior | **Ask before push** (change from auto) |
| "Don't ask again" scope | Per-project |
| GitHub Modal after Git init | Show modal immediately |

### Action Items

- [ ] **Phase 5/6:** Add checkbox "Push to GitHub after connecting" in GitHub modal (default checked)
- [ ] **Phase 5:** User must confirm push before it happens (not automatic)

---

## Unresolved Questions

None - all design decisions validated.
