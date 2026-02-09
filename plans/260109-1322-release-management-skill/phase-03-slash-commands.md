# Phase 3: Slash Command Updates

**Status:** Pending
**Estimated Time:** 0.5 hours
**Dependency:** Phase 1 & 2 complete
**Files:**
- `/home/plateau/.claude/commands/release/beta.md` (update)
- `/home/plateau/.claude/commands/release/stable.md` (create)

## Objective

Update `/release:beta` to invoke skill, create `/release:stable`, keeping commands lightweight.

## Tasks Breakdown

### Task 3.1: Backup Existing Command
**Time:** 2 min

Before modifying, backup original:
```bash
cp /home/plateau/.claude/commands/release/beta.md \
   /home/plateau/.claude/commands/release/beta.md.backup-$(date +%Y%m%d)
```

**Acceptance:**
- ✅ Backup created with timestamp

### Task 3.2: Update `/release:beta`
**Time:** 15 min

**File:** `/home/plateau/.claude/commands/release/beta.md`

Rewrite to invoke skill:
```markdown
---
description: Release beta version (auto bump and push)
allowed-tools: Skill, Bash, AskUserQuestion
argument-hint: [--dry-run]
---

# Beta Release Command

Automates beta version releases with automatic version bumping, tagging, and pushing.

## Context

Get current project state to show user:
- Current version: !`node -p "require('./package.json').version"`
- Current branch: !`git branch --show-current`
- Working tree: !`git status --porcelain | wc -l` uncommitted changes

## Task

Invoke the `release-management` skill with the following configuration:

**Arguments:**
```
--type=beta
```

**Flags:**
- If user provided `--dry-run` argument ($1 == "--dry-run"), add `--dry-run` flag
- Show diff: enabled (skill will prompt)
- Confirm push: enabled (skill will prompt)

**Invocation:**
Use Skill tool:
```
skill: release-management
args: --type=beta [--dry-run if $1 is --dry-run]
```

**Context to pass:**
The skill will handle:
- Pre-flight validation (working tree, branch, package.json)
- Version calculation
- User confirmations
- Script execution
- GitHub draft creation
- Summary reporting

## Notes

This command is a lightweight wrapper around the `release-management` skill.
All logic is in the skill for reusability and maintainability.

For manual invocation, use:
```bash
~/.claude/skills/release-management/scripts/release.sh --type=beta [--dry-run]
```
```

**Acceptance:**
- ✅ Command invokes skill correctly
- ✅ Passes dry-run flag when provided
- ✅ Shows current state to user
- ✅ Clear and concise

### Task 3.3: Create `/release:stable`
**Time:** 15 min

**File:** `/home/plateau/.claude/commands/release/stable.md`

Create new command for stable releases:
```markdown
---
description: Release stable version (production-ready)
allowed-tools: Skill, Bash, AskUserQuestion
argument-hint: [--dry-run]
---

# Stable Release Command

Automates stable (production) version releases with automatic version bumping, tagging, and pushing.

⚠️ **WARNING:** Stable releases should only be created from tested, production-ready code.

## Context

Get current project state to show user:
- Current version: !`node -p "require('./package.json').version"`
- Current branch: !`git branch --show-current`
- Working tree: !`git status --porcelain | wc -l` uncommitted changes

## Branch Requirements

Stable releases can only be created from:
- `main` branch
- `master` branch

If on beta/develop branch, merge to main first.

## Task

Invoke the `release-management` skill with the following configuration:

**Arguments:**
```
--type=stable
```

**Flags:**
- If user provided `--dry-run` argument ($1 == "--dry-run"), add `--dry-run` flag
- Show diff: enabled (skill will prompt)
- Confirm push: enabled (skill will prompt)
- Extra confirmation: enabled (skill will prompt for production release)

**Invocation:**
Use Skill tool:
```
skill: release-management
args: --type=stable [--dry-run if $1 is --dry-run]
```

**Context to pass:**
The skill will handle:
- Pre-flight validation (working tree, branch, package.json)
- Version calculation
- User confirmations (including extra production confirmation)
- Script execution
- GitHub draft creation
- Summary reporting

## Version Behavior

| Current Version | New Stable Version |
|-----------------|-------------------|
| `1.1.6-beta.5` | `1.1.6` (removes beta) |
| `1.1.6` | `1.1.7` (patch bump) |

## Notes

This command is a lightweight wrapper around the `release-management` skill.
All logic is in the skill for reusability and maintainability.

For manual invocation, use:
```bash
~/.claude/skills/release-management/scripts/release.sh --type=stable [--dry-run]
```

## Recommended Workflow

1. Complete and test all features on beta branch
2. Merge beta → main (via PR with reviews)
3. Switch to main branch
4. Run `/release:stable` to create production release
5. Publish GitHub release draft
6. Announce to team and users
```

**Acceptance:**
- ✅ Command created
- ✅ Invokes skill with --type=stable
- ✅ Shows warnings about production
- ✅ Documents workflow
- ✅ Clear branch requirements

### Task 3.4: Test Both Commands
**Time:** 10 min

End-to-end testing:

**Test 1: Beta Dry-Run**
```
User: /release:beta --dry-run
Expected:
  • Shows current state
  • Invokes skill with --type=beta --dry-run
  • Shows preview
  • Exits without changes
```

**Test 2: Beta Release**
```
User: /release:beta
Expected:
  • Shows current state
  • Invokes skill with --type=beta
  • Prompts for diff
  • Prompts for confirmation
  • Executes release
  • Creates GitHub draft (if confirmed)
  • Shows summary
```

**Test 3: Stable Dry-Run**
```
User: /release:stable --dry-run
Expected:
  • Shows current state
  • Invokes skill with --type=stable --dry-run
  • Shows preview
  • Exits without changes
```

**Test 4: Stable Release**
```
User: /release:stable
Expected:
  • Shows current state
  • Invokes skill with --type=stable
  • Prompts for diff
  • Prompts for confirmation
  • Extra production confirmation
  • Executes release
  • Creates GitHub draft (if confirmed)
  • Shows summary
```

**Test 5: Error Handling**
```
Test scenarios:
  • Wrong branch → Clear error
  • Uncommitted changes → Clear error
  • Tag exists → Clear error
  • No package.json → Clear error
```

**Acceptance:**
- ✅ All test scenarios pass
- ✅ Errors handled gracefully
- ✅ User experience smooth

### Task 3.5: Update Command Catalog
**Time:** 5 min

Regenerate command catalog to include new stable command:
```bash
python ~/.claude/scripts/generate_catalogs.py --commands
```

Verify `/release:stable` appears in catalog.

**Acceptance:**
- ✅ Catalog updated
- ✅ Both commands listed
- ✅ Descriptions accurate

## Files Modified

**Updated:**
- `/home/plateau/.claude/commands/release/beta.md` (~60 lines)

**Created:**
- `/home/plateau/.claude/commands/release/stable.md` (~100 lines)
- `/home/plateau/.claude/commands/release/beta.md.backup-YYYYMMDD`

## Migration Notes

### For Users

**Old way:**
```
/release:beta
  → Executes inline bash steps
  → Variable passing issues
  → Not reusable
```

**New way:**
```
/release:beta
  → Invokes release-management skill
  → Skill invokes bash script
  → Fully reusable
```

**User experience:**
- Same command invocation
- Better error handling
- Interactive confirmations
- GitHub draft creation
- Clearer output

**Breaking changes:**
- None - command interface unchanged
- New features added (confirmations, drafts)

### For Developers

**Advantages:**
- Logic separated into skill (reusable)
- Script testable independently
- Easy to add new release types (alpha, rc)
- Consistent across projects

## Testing Checklist

- [ ] Backup created successfully
- [ ] `/release:beta` invokes skill correctly
- [ ] `/release:beta --dry-run` works
- [ ] `/release:stable` created successfully
- [ ] `/release:stable --dry-run` works
- [ ] Context commands show current state
- [ ] Errors handled gracefully
- [ ] Command catalog updated
- [ ] Both commands appear in `/help`
- [ ] User experience smooth

## Rollback Plan

If issues found:
```bash
# Restore backup
cp /home/plateau/.claude/commands/release/beta.md.backup-YYYYMMDD \
   /home/plateau/.claude/commands/release/beta.md

# Remove stable command
rm /home/plateau/.claude/commands/release/stable.md

# Regenerate catalog
python ~/.claude/scripts/generate_catalogs.py --commands
```

## Next Phase

After Phase 3 complete and tested, proceed to Phase 4: Documentation & Testing.
