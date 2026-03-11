# Brainstorm: Release Management Skill

**Date:** 2026-01-09
**Context:** Fix `/release:beta` slash command errors & convert to reusable skill
**Reporter:** Solution Brainstormer

---

## Problem Statement

Current `/release:beta` slash command has critical issues:

1. **Variable passing failure** - `NEW_VERSION` env var lost between bash commands
2. **Heredoc scope issue** - `CURRENT_VERSION` not accessible in Node.js heredoc
3. **Not reusable** - Logic embedded in slash command, can't reuse
4. **Limited scope** - Only beta releases, no stable release support

## Requirements

- ✅ Fix variable passing issues
- ✅ Support dry-run mode
- ✅ Trap-based rollback on failure
- ✅ Support both beta & stable releases
- ✅ Interactive confirmations (show diff, confirm push)
- ✅ Reusable across projects
- ✅ Testable independently

## Evaluated Approaches

### 1. Fix multi-step inline ❌
**Pros:** Quick fix, minimal changes
**Cons:** Still not reusable, violates DRY, hard to test

### 2. Bash script file ⚠️
**Pros:** Testable, reusable
**Cons:** No validation/UX layer, not integrated with Claude workflows

### 3. Pure skill (markdown only) ❌
**Pros:** Flexible, Claude orchestrates
**Cons:** Slow, token-heavy, can't test independent

### 4. Node.js script ❌
**Pros:** Better error handling
**Cons:** Over-engineering, loses bash simplicity

### 5. Hybrid Skill + Bash Script ✅ **SELECTED**
**Pros:**
- Separation of concerns (script=logic, skill=UX)
- Testable independent
- Reusable across projects
- Fast execution (native bash)
- Clean abstractions
- Follows YAGNI/KISS/DRY

**Cons:**
- More files to maintain (acceptable trade-off)

## Recommended Solution

### Architecture

```
~/.claude/skills/release-management/
├── skill.md              # Skill definition & Claude instructions
├── release.sh            # Unified bash script (beta + stable)
└── README.md             # Usage & customization docs

~/.claude/commands/
├── release-beta.md       # Wrapper: invoke skill with --beta
└── release-stable.md     # Wrapper: invoke skill with --stable
```

### Flow

```
User: /release:beta [--dry-run]
  ↓
SlashCommand (release-beta.md)
  • Validate project (package.json exists)
  • Parse args
  ↓
Skill (release-management/skill.md)
  • Pre-flight checks (git clean, branch valid)
  • Get current version & calculate new
  • Show proposed changes
  • Show diff (if requested)
  • Invoke release.sh with flags
  • Confirm before push (if not dry-run)
  • Create GitHub draft release
  • Report summary
  ↓
Bash Script (release.sh)
  • Version bump logic
  • Git commit, tag, push
  • Atomic operations with rollback
  • Exit codes for error handling
```

### Script Features

**release.sh flags:**
- `--type=[beta|stable]` - Release type (required)
- `--dry-run` - Preview without execution
- `--skip-push` - Local only (no remote push)
- `--no-tag` - Skip tagging
- `--lockfile=<path>` - Custom lockfile path

**Version bump logic:**
```bash
# Beta releases (beta branch)
1.1.6-beta.3 → 1.1.6-beta.4
1.1.6 → 1.1.7-beta.1

# Stable releases (main branch)
1.1.6-beta.5 → 1.1.6
1.1.6 → 1.1.7
```

**Error handling:**
- Trap-based rollback on failure
- Validates tag doesn't exist remotely
- Atomic commit+tag+push operation
- Clear error messages with recovery instructions

### Key Fixes

1. **Variable passing** - Script handles all vars internally, no inter-command passing needed
2. **Heredoc issue** - Use `-e` flag instead of heredoc, or pass as arg
3. **Reusability** - Skill can be used in any npm project
4. **Extensibility** - Easy to add alpha, rc, patch releases later

## Implementation Risks

**Low risk:**
- Well-understood bash operations
- Clear rollback strategy
- Testable script logic

**Mitigation:**
- Unit test script with mock git repo
- Document edge cases in README
- Add debug mode (`--verbose`)

## Success Metrics

✅ Script passes dry-run without errors
✅ Beta release completes successfully
✅ Rollback works on simulated failure
✅ Works on fresh project clone
✅ GitHub draft created automatically

## Next Steps

1. Create implementation plan (`/plan:hard`)
2. Implement `release.sh` script
3. Create skill definition
4. Update slash commands (wrappers)
5. Test on test repository
6. Deploy to production
7. Document in ~/.claude/README.md

## Unresolved Questions

None - all requirements clarified through Q&A.

---

**Status:** Ready for implementation
**Estimated complexity:** Medium (3-4 hours)
**Dependencies:** None
