---
status: completed
created: 2026-01-09
type: feature
priority: high
complexity: medium
estimated_effort: 3-4 hours
---

# Implementation Plan: Release Management Skill

## Overview

Convert `/release:beta` slash command to reusable skill with hybrid architecture (Bash script + Skill wrapper). Fixes variable passing issues, adds stable release support, maintains dry-run and rollback capabilities.

## Problem Statement

Current `/release:beta` command has critical issues:
1. **Variable passing failure** - `NEW_VERSION` env var lost between bash commands
2. **Heredoc scope issue** - `CURRENT_VERSION` not accessible in Node.js heredoc
3. **Not reusable** - Logic embedded in command, can't reuse across projects
4. **Limited scope** - Only beta releases, no stable support

## Solution Architecture

### Hybrid Model
- **Bash Script** (`release.sh`) - Core logic, version bump, git operations
- **Skill Wrapper** (`skill.md`) - UX, validation, confirmations, reporting
- **Slash Commands** - Lightweight wrappers invoking skill with flags

### Directory Structure
```
~/.claude/skills/release-management/
├── SKILL.md              # Skill definition & instructions
├── scripts/
│   └── release.sh        # Main bash script
├── references/
│   └── version-schemes.md # Version bump logic reference
└── README.md             # Usage docs

~/.claude/commands/release/
├── beta.md               # Invokes skill with --type=beta
└── stable.md             # Invokes skill with --type=stable (new)
```

## Technical Design

### 1. Bash Script (`release.sh`)

**Purpose:** Pure bash script containing all release logic

**Features:**
- Self-contained, no inter-command variable passing
- Supports beta & stable releases
- Atomic operations with rollback
- Exit codes for error handling
- Verbose mode for debugging

**Flags:**
```bash
--type=[beta|stable]      # Required: Release type
--dry-run                 # Preview only, no changes
--skip-push               # Local only, no remote push
--no-tag                  # Skip git tagging
--lockfile=<path>         # Custom lockfile path
--verbose                 # Debug output
```

**Version Bump Logic:**

| Current Version | Release Type | New Version |
|-----------------|--------------|-------------|
| `1.1.6-beta.3` | beta | `1.1.6-beta.4` |
| `1.1.6` | beta | `1.1.7-beta.1` |
| `1.1.6-beta.5` | stable | `1.1.6` |
| `1.1.6` | stable | `1.1.7` |

**Branch Validation:**
- Beta releases: `beta` or `develop` branches only
- Stable releases: `main` or `master` branches only

**Exit Codes:**
- `0` - Success
- `1` - Validation error (working tree, branch, version format)
- `2` - Tag already exists
- `3` - npm version command failed
- `4` - Git operation failed

**Rollback Strategy:**
```bash
# Trap ERR signal
trap cleanup ERR

cleanup() {
  git tag -d "v$NEW_VERSION" 2>/dev/null
  git reset --hard "$PREV_HEAD"
  echo "✓ Rollback complete"
  exit 1
}
```

### 2. Skill Definition (`SKILL.md`)

**Purpose:** Claude orchestration layer for UX and validation

**Responsibilities:**
1. **Pre-flight Checks**
   - Validate project has `package.json`
   - Check git status (clean working tree)
   - Verify correct branch for release type
   - Fetch remote tags

2. **User Interaction**
   - Show current version & proposed version
   - Display diff if requested (via AskUserQuestion)
   - Confirm before push if not dry-run

3. **Script Execution**
   - Invoke `release.sh` with appropriate flags
   - Parse exit codes and handle errors
   - Show progress updates

4. **Post-Release**
   - Create GitHub draft release (via `gh` command)
   - Generate changelog from commits
   - Display summary report

**Flow:**
```
User: /release:beta [--dry-run]
  ↓
Skill activated
  ↓
1. Validate project (package.json exists)
2. Parse args (dry-run flag)
3. Get current state (version, branch, git status)
4. Calculate new version
5. Show proposed changes
6. Ask: "Show diff before proceeding?" (if not dry-run)
7. Invoke release.sh with flags
8. Handle exit code
9. Ask: "Create GitHub draft release?" (if pushed)
10. Report summary
```

### 3. Slash Command Wrappers

**`/release:beta` (update existing)**
```markdown
---
description: Release beta version (auto bump and push)
allowed-tools: Bash(release.sh, gh *), AskUserQuestion
argument-hint: [--dry-run]
---

Validate project has package.json, then invoke release-management skill with:
- Release type: beta
- Dry run: based on $1 argument
- Show diff: yes (prompt user)
- Confirm push: yes (prompt user)
```

**`/release:stable` (new)**
```markdown
---
description: Release stable version (auto bump and push)
allowed-tools: Bash(release.sh, gh *), AskUserQuestion
argument-hint: [--dry-run]
---

Validate project has package.json, then invoke release-management skill with:
- Release type: stable
- Dry run: based on $1 argument
- Show diff: yes (prompt user)
- Confirm push: yes (prompt user)
- Extra confirmation: "Confirm stable release to production?"
```

## Implementation Phases

### Phase 1: Bash Script Implementation
**File:** `~/.claude/skills/release-management/scripts/release.sh`

**Tasks:**
1. Create script with argument parsing (`--type`, `--dry-run`, etc.)
2. Implement version calculation (fix heredoc issue with `-e` flag)
3. Add validation logic (working tree, branch, tag existence)
4. Implement dry-run mode (show preview, exit early)
5. Add version bump logic (`npm version --no-git-tag-version`)
6. Implement atomic commit+tag+push with trap-based rollback
7. Add exit codes for different error scenarios
8. Add verbose mode for debugging
9. Test with mock git repository

**Key Fix - Version Calculation:**
```bash
# OLD (broken heredoc):
NEW_VERSION=$(node << 'EOF'
const v = process.env.CURRENT_VERSION;  # Doesn't work!
...
EOF
)

# NEW (inline with -e flag):
NEW_VERSION=$(node -e "
const v = '$CURRENT_VERSION';
if (v.includes('-beta.')) {
  const [base, beta] = v.split('-beta.');
  console.log(base + '-beta.' + (parseInt(beta) + 1));
} else if (/^\d+\.\d+\.\d+$/.test(v)) {
  const parts = v.split('.');
  parts[2] = parseInt(parts[2]) + 1;
  console.log(parts.join('.') + '-beta.1');
}
")
```

**Acceptance Criteria:**
- ✅ Dry-run shows correct preview without changes
- ✅ Beta bump works: `1.1.6-beta.3` → `1.1.6-beta.4`
- ✅ Stable-to-beta works: `1.1.6` → `1.1.7-beta.1`
- ✅ Rollback works on simulated failure
- ✅ Exit codes correctly indicate error types
- ✅ Script runs independent of Claude Code

### Phase 2: Skill Wrapper Implementation
**File:** `~/.claude/skills/release-management/SKILL.md`

**Tasks:**
1. Create skill definition with metadata
2. Implement pre-flight validation logic
3. Add user interaction flows (AskUserQuestion for diff, confirm)
4. Implement script invocation with error handling
5. Add GitHub draft release creation
6. Create summary report template
7. Add references for version schemes

**Interaction Points:**
```typescript
// Example AskUserQuestion calls
1. "Show git diff before proceeding?" (if not dry-run)
   - Yes → Run `git diff` and display
   - No → Continue

2. "Confirm push to remote?" (before push, if not dry-run)
   - Yes → Execute push
   - No → Skip push (local only)

3. "Create GitHub draft release?" (after successful push)
   - Yes → Generate changelog & create draft
   - No → Skip
```

**Acceptance Criteria:**
- ✅ Skill validates project structure
- ✅ Prompts user appropriately
- ✅ Handles script exit codes correctly
- ✅ Creates GitHub draft with changelog
- ✅ Shows clear summary report

### Phase 3: Slash Command Updates
**Files:**
- `/home/plateau/.claude/commands/release/beta.md` (update)
- `/home/plateau/.claude/commands/release/stable.md` (create)

**Tasks:**
1. Update `/release:beta` to invoke skill instead of inline bash
2. Keep existing context commands (!`` syntax) for user info
3. Create `/release:stable` command
4. Add extra confirmation for stable releases
5. Test both commands end-to-end

**Acceptance Criteria:**
- ✅ `/release:beta --dry-run` shows preview
- ✅ `/release:beta` prompts for confirmation and pushes
- ✅ `/release:stable` requires production confirmation
- ✅ Both commands create GitHub drafts

### Phase 4: Documentation & Testing
**Files:**
- `~/.claude/skills/release-management/README.md`
- `~/.claude/skills/release-management/references/version-schemes.md`

**Tasks:**
1. Write comprehensive README
   - Installation/setup
   - Usage examples
   - Customization guide
   - Troubleshooting
2. Document version bump schemes
3. Create test checklist
4. Test on MultiClaude project
5. Test rollback scenarios
6. Verify cross-project compatibility

**Test Scenarios:**
```bash
# Beta releases
1. Clean beta bump: 1.1.6-beta.3 → 1.1.6-beta.4
2. Stable to beta: 1.1.6 → 1.1.7-beta.1
3. Dry-run mode
4. Rollback on push failure
5. Tag already exists error

# Stable releases
6. Beta to stable: 1.1.6-beta.5 → 1.1.6
7. Stable bump: 1.1.6 → 1.1.7
8. Wrong branch error
9. Uncommitted changes error

# Edge cases
10. No lockfile present
11. Multiple lockfiles present
12. Network failure during push
13. GitHub draft creation failure
```

**Acceptance Criteria:**
- ✅ All test scenarios pass
- ✅ Documentation complete and accurate
- ✅ Works on fresh project clone
- ✅ Rollback tested and verified

## Migration Strategy

### Step 1: Create skill files (Phase 1-2)
- No impact on existing command

### Step 2: Update `/release:beta` command (Phase 3)
- Backup existing command
- Test new version in parallel
- Switch when validated

### Step 3: Deploy `/release:stable` (Phase 3)
- New command, no breaking changes

### Step 4: Announce and document (Phase 4)
- Update `~/.claude/README.md`
- Notify users of new capabilities

## Risk Assessment

### Low Risks
- Script logic well-understood (existing bash operations)
- Clear rollback strategy
- Testable independently

### Mitigations
- **Variable passing** - Script handles all vars internally, no passing between commands
- **Heredoc issue** - Use `-e` flag with inline string substitution
- **Testing** - Mock git repository for isolated testing
- **Debugging** - Verbose mode shows all operations

## Dependencies

**External:**
- Node.js (for `npm version` command)
- Git (for version control operations)
- GitHub CLI (`gh`) - optional, for draft releases

**Internal:**
- None - self-contained skill

## Success Metrics

1. ✅ Script passes dry-run without errors
2. ✅ Beta release completes successfully on MultiClaude
3. ✅ Rollback works on simulated failure
4. ✅ Works on fresh project clone
5. ✅ GitHub draft created automatically
6. ✅ Zero variable passing issues
7. ✅ Reusable across different npm projects

## Rollback Plan

If skill fails after deployment:
1. Restore backup of `/release:beta` command
2. Keep skill files (no harm, not activated)
3. Investigate and fix issues
4. Re-deploy when ready

## Future Enhancements

**Out of scope for this plan:**
- Alpha releases
- RC (release candidate) releases
- Custom version schemes
- Changelog generation (basic version only)
- Automated testing in CI/CD

**Can be added later without breaking changes**

## Timeline Estimate

- Phase 1 (Script): 1-1.5 hours
- Phase 2 (Skill): 1 hour
- Phase 3 (Commands): 0.5 hours
- Phase 4 (Docs/Testing): 1 hour
- **Total: 3.5-4 hours**

## Notes

- Follows YAGNI (implements what's needed now)
- Follows KISS (clear separation, simple bash)
- Follows DRY (one script, multiple interfaces)
- Kebab-case naming for files
- Keep files under 200 lines where possible
- No over-engineering (no Node.js rewrite)

---

**Plan Status:** Complete
**Phase 1:** Complete (2026-01-09) - Bash script implemented
**Phase 2:** Complete (2026-01-10) - Skill wrapper implemented
**Phase 3:** Complete (2026-01-10) - Slash commands updated
**Phase 4:** Complete (2026-01-10) - Documentation & testing done, 12/12 tests passed
