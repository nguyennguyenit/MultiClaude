# Planning Summary: Release Management Skill

**Date:** 2026-01-09
**Status:** Plan Complete - Ready for Implementation
**Complexity:** Medium (3-4 hours estimated)

## Overview

Comprehensive implementation plan created to convert `/release:beta` slash command to reusable skill with hybrid architecture (Bash script + Skill wrapper).

## Problem Solved

**Current issues:**
1. Variable passing failure between bash commands
2. Heredoc scope issue with environment variables
3. Not reusable across projects
4. Limited to beta releases only

**Solution:**
Hybrid architecture with bash script handling core logic and skill wrapper providing UX/validation layer.

## Plan Structure

```
plans/260109-1322-release-management-skill/
├── plan.md                      # Main plan (12 sections, YAML frontmatter)
├── phase-01-bash-script.md      # Script implementation (9 tasks)
├── phase-02-skill-wrapper.md    # Skill wrapper (6 tasks)
├── phase-03-slash-commands.md   # Command updates (5 tasks)
├── phase-04-documentation.md    # Docs & testing (4 tasks)
└── reports/
    └── planning-summary.md      # This file
```

## Implementation Phases

### Phase 1: Bash Script (1-1.5h)
**File:** `~/.claude/skills/release-management/scripts/release.sh`

**Key tasks:**
- Argument parsing (--type, --dry-run, --skip-push, etc.)
- Pre-flight validation (working tree, branch, package.json)
- Version calculation (FIX: use -e flag instead of heredoc)
- Tag validation (check remote tags)
- Dry-run mode
- Version bump execution
- Atomic commit+tag+push with trap-based rollback
- Success reporting

**Key fix:**
```bash
# OLD (broken):
NEW_VERSION=$(node << 'EOF'
const v = process.env.CURRENT_VERSION;  # Doesn't work!
EOF
)

# NEW (working):
NEW_VERSION=$(node -e "const v = '$CURRENT_VERSION'; ...")
```

### Phase 2: Skill Wrapper (1h)
**File:** `~/.claude/skills/release-management/SKILL.md`

**Key tasks:**
- Skill metadata & structure
- Pre-flight validation instructions
- User interaction flow (AskUserQuestion for diff, confirm)
- Script invocation logic
- GitHub draft release creation
- Summary report template

**Interactions:**
1. Show diff before proceeding?
2. Confirm push to remote?
3. Extra confirmation for stable releases
4. Create GitHub draft release?

### Phase 3: Slash Commands (0.5h)
**Files:**
- `/home/plateau/.claude/commands/release/beta.md` (update)
- `/home/plateau/.claude/commands/release/stable.md` (create)

**Key tasks:**
- Backup existing command
- Update `/release:beta` to invoke skill
- Create `/release:stable` command
- Test both commands end-to-end
- Update command catalog

### Phase 4: Documentation & Testing (1h)
**Files:**
- `~/.claude/skills/release-management/README.md`
- `~/.claude/skills/release-management/references/version-schemes.md`

**Key tasks:**
- Comprehensive README (400 lines)
- Version schemes reference (200 lines)
- Automated test suite (6 test scenarios)
- Integration testing on MultiClaude
- Verify all documentation accuracy

## Technical Highlights

### Version Bump Logic

| Current Version | Release Type | New Version |
|-----------------|--------------|-------------|
| `1.1.6-beta.3` | beta | `1.1.6-beta.4` |
| `1.1.6` | beta | `1.1.7-beta.1` |
| `1.1.6-beta.5` | stable | `1.1.6` |
| `1.1.6` | stable | `1.1.7` |

### Exit Codes
- `0` - Success
- `1` - Validation error
- `2` - Tag exists
- `3` - npm version failed
- `4` - Git operation failed (rollback triggered)

### Rollback Strategy
```bash
trap cleanup ERR

cleanup() {
  git tag -d "v$NEW_VERSION" 2>/dev/null
  git reset --hard "$PREV_HEAD"
  echo "✓ Rollback complete"
  exit 4
}
```

## Success Metrics

**Must achieve:**
- ✅ Script passes dry-run without errors
- ✅ Beta release completes successfully
- ✅ Rollback works on simulated failure
- ✅ Works on fresh project clone
- ✅ GitHub draft created automatically
- ✅ Zero variable passing issues
- ✅ Reusable across projects

## Risk Assessment

**Low Risk** - Well-understood bash operations, clear rollback strategy, testable independently.

**Mitigations:**
- Script handles all vars internally (no inter-command passing)
- Use `-e` flag instead of heredoc
- Mock git repository for testing
- Verbose mode for debugging

## Files Summary

**Created:**
- Script: `~/.claude/skills/release-management/scripts/release.sh` (~200 lines)
- Skill: `~/.claude/skills/release-management/SKILL.md` (~300 lines)
- Command: `~/.claude/commands/release/stable.md` (~100 lines)
- README: `~/.claude/skills/release-management/README.md` (~400 lines)
- Reference: `~/.claude/skills/release-management/references/version-schemes.md` (~200 lines)
- Tests: `/tmp/test-release-management.sh` (~200 lines)

**Updated:**
- Command: `/home/plateau/.claude/commands/release/beta.md` (~60 lines)

**Total:** ~1460 lines across 7 files

## Timeline Estimate

- Phase 1: 1-1.5 hours (script implementation)
- Phase 2: 1 hour (skill wrapper)
- Phase 3: 0.5 hours (commands)
- Phase 4: 1 hour (docs & testing)
- **Total: 3.5-4 hours**

## Principles Followed

✅ **YAGNI** - Implements what's needed now (beta + stable only)
✅ **KISS** - Clear separation, simple bash script
✅ **DRY** - One script, multiple interfaces (command/skill/direct)

## Next Actions

1. **Review plan** - Stakeholder approval
2. **Execute Phase 1** - Implement bash script
3. **Execute Phase 2** - Create skill wrapper
4. **Execute Phase 3** - Update commands
5. **Execute Phase 4** - Documentation & testing
6. **Deploy** - Announce and document in main README

## Notes

- Plan includes backup strategy for rollback if issues found
- All phase files have detailed task breakdowns with acceptance criteria
- Testing strategy comprehensive (automated + manual + integration)
- Documentation complete before implementation starts
- Follows development rules (kebab-case, <200 lines per file where possible)

---

**Plan Status:** ✅ Complete and ready for execution
**Active Plan Set:** Yes (`set-active-plan.cjs` executed)
**Brainstorm Report:** `plans/reports/brainstorm-260109-1322-release-management-skill.md`
**Estimated Completion:** 3.5-4 hours of focused work
