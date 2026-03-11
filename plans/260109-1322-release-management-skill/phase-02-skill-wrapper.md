# Phase 2: Skill Wrapper Implementation

**Status:** Pending
**Estimated Time:** 1 hour
**Dependency:** Phase 1 complete
**File:** `~/.claude/skills/release-management/SKILL.md`

## Objective

Create Claude orchestration layer for UX, validation, and user interaction around bash script.

## Tasks Breakdown

### Task 2.1: Skill Metadata & Structure
**Time:** 10 min

Create skill definition:
```markdown
---
name: release-management
description: Manage version releases (beta and stable) with automatic version bumping, git tagging, and GitHub draft creation
version: 1.0.0
author: claude-code
category: devops
tags: [release, versioning, git, npm, changelog]
---

# Release Management Skill

Automates version releases for npm projects with support for beta and stable releases.

## Features

- Automatic version bumping (beta and stable)
- Git tagging and pushing
- Trap-based rollback on failure
- Dry-run mode for preview
- GitHub draft release creation
- Interactive confirmations
- Comprehensive validation

## Usage

Invoke via slash commands:
- `/release:beta [--dry-run]` - Release beta version
- `/release:stable [--dry-run]` - Release stable version

Or directly via Skill tool:
```
Skill: release-management
Args: --type=beta [--dry-run]
```

## Requirements

- Node.js project with package.json
- Git repository with clean working tree
- GitHub CLI (gh) - optional, for draft releases
```

**Acceptance:**
- ✅ Clear skill metadata
- ✅ Usage instructions documented
- ✅ Requirements listed

### Task 2.2: Pre-flight Validation Instructions
**Time:** 15 min

Define validation flow:
```markdown
## Validation Flow

When skill activated, Claude MUST perform these checks IN ORDER:

### 1. Parse Arguments
```bash
# Extract from args or slash command
RELEASE_TYPE=""    # beta or stable (required)
DRY_RUN=false      # --dry-run flag
SHOW_DIFF=true     # default true, can be overridden
CONFIRM_PUSH=true  # default true, can be overridden
```

### 2. Project Validation
Use Bash tool to check:
```bash
# Check package.json exists
if [ ! -f "package.json" ]; then
  echo "Error: Not an npm project (package.json not found)"
  exit 1
fi
```

**On failure:** Show error and exit.

### 3. Git Status Check
Use Bash tool to check:
```bash
# Check working tree
if [ -n "$(git status --porcelain)" ]; then
  echo "Error: Working tree has uncommitted changes"
  git status --short
  exit 1
fi
```

**On failure:** Show uncommitted files and exit.

### 4. Branch Validation
Use Bash tool to check:
```bash
BRANCH=$(git branch --show-current)

if [ "$RELEASE_TYPE" = "beta" ]; then
  if [[ "$BRANCH" != "beta" && "$BRANCH" != "develop" ]]; then
    echo "Error: Beta releases require 'beta' or 'develop' branch"
    echo "Current branch: $BRANCH"
    exit 1
  fi
elif [ "$RELEASE_TYPE" = "stable" ]; then
  if [[ "$BRANCH" != "main" && "$BRANCH" != "master" ]]; then
    echo "Error: Stable releases require 'main' or 'master' branch"
    echo "Current branch: $BRANCH"
    exit 1
  fi
fi
```

**On failure:** Show branch error and exit.

### 5. Get Current State
Use Bash tool to gather:
```bash
# Current version
CURRENT_VERSION=$(node -p "require('./package.json').version")

# Current branch
CURRENT_BRANCH=$(git branch --show-current)

# Remote status
git fetch --tags origin --quiet
```

**Output to user:**
```
Current state:
  • Version: $CURRENT_VERSION
  • Branch: $CURRENT_BRANCH
  • Release type: $RELEASE_TYPE
```
```

**Acceptance:**
- ✅ All validations defined
- ✅ Clear error messages
- ✅ User sees current state

### Task 2.3: User Interaction Flow
**Time:** 20 min

Define interaction points:
```markdown
## User Interaction

### Interaction 1: Show Diff (if not dry-run)
If `SHOW_DIFF=true` and not `--dry-run`:

Use AskUserQuestion:
```
Question: "Show git diff before proceeding?"
Options:
  - "Yes - Show me the changes"
  - "No - Continue without viewing"
```

If "Yes":
```bash
git diff HEAD
```

### Interaction 2: Confirm Push (if not dry-run)
If `CONFIRM_PUSH=true` and not `--dry-run`:

Use AskUserQuestion:
```
Question: "Ready to commit, tag, and push v$NEW_VERSION?"
Options:
  - "Yes - Proceed with release"
  - "No - Cancel release"
  - "Local only - Skip push to remote"
```

If "No": Exit with message "Release cancelled by user"
If "Local only": Add `--skip-push` flag to script invocation

### Interaction 3: Stable Release Extra Confirmation
If `RELEASE_TYPE=stable` and not `--dry-run`:

Use AskUserQuestion:
```
Question: "⚠️ Confirm production stable release?"
Options:
  - "Yes - This is a production-ready release"
  - "No - Cancel, I need to review again"
```

If "No": Exit with message "Stable release cancelled"

### Interaction 4: Create GitHub Draft (after successful push)
If push succeeded and `gh` available:

Use AskUserQuestion:
```
Question: "Create GitHub draft release?"
Options:
  - "Yes - Generate changelog and create draft"
  - "No - Skip GitHub release"
```

If "Yes": Proceed to changelog generation
```

**Acceptance:**
- ✅ All interaction points defined
- ✅ Clear questions and options
- ✅ Handles all user choices

### Task 2.4: Script Invocation Logic
**Time:** 15 min

Define how to invoke bash script:
```markdown
## Script Execution

### Construct Command
Based on user choices, build command:
```bash
SCRIPT_PATH="$HOME/.claude/skills/release-management/scripts/release.sh"

# Base command
CMD="$SCRIPT_PATH --type=$RELEASE_TYPE"

# Add flags
[ "$DRY_RUN" = true ] && CMD="$CMD --dry-run"
[ "$SKIP_PUSH" = true ] && CMD="$CMD --skip-push"
[ "$VERBOSE" = true ] && CMD="$CMD --verbose"

# Execute
$CMD
```

### Handle Exit Codes
```bash
EXIT_CODE=$?

case $EXIT_CODE in
  0)
    echo "✓ Release successful"
    # Proceed to post-release actions
    ;;
  1)
    echo "✗ Validation failed"
    # Show script output (already displayed)
    exit 1
    ;;
  2)
    echo "✗ Tag already exists"
    # Show script output
    exit 1
    ;;
  3)
    echo "✗ npm version failed"
    # Show script output
    exit 1
    ;;
  4)
    echo "✗ Git operation failed (rollback complete)"
    # Show script output
    exit 1
    ;;
  *)
    echo "✗ Unknown error (exit code: $EXIT_CODE)"
    exit 1
    ;;
esac
```

### On Success
If exit code 0:
1. Capture output (NEW_VERSION)
2. Proceed to GitHub draft creation if requested
3. Show summary report
```

**Acceptance:**
- ✅ Script invoked with correct flags
- ✅ Exit codes handled properly
- ✅ Errors shown to user

### Task 2.5: GitHub Draft Release Creation
**Time:** 15 min

Define changelog generation:
```markdown
## GitHub Draft Release

### Prerequisites
Check if `gh` available:
```bash
if ! command -v gh &> /dev/null; then
  echo "⚠️ GitHub CLI (gh) not found - skipping draft creation"
  echo "Install: https://cli.github.com/"
  exit 0
fi
```

### Generate Changelog
Extract commits since last tag:
```bash
# Get previous tag
PREV_TAG=$(git describe --tags --abbrev=0 HEAD^ 2>/dev/null || echo "")

# Generate changelog
if [ -n "$PREV_TAG" ]; then
  # From previous tag to current
  CHANGELOG=$(git log $PREV_TAG..HEAD --oneline --pretty=format:"- %s (%h)" | sed 's/^/  /')
  COMPARE_URL="compare/$PREV_TAG...v$NEW_VERSION"
else
  # First release - all commits
  CHANGELOG=$(git log --oneline --pretty=format:"- %s (%h)" | sed 's/^/  /')
  COMPARE_URL="commits/v$NEW_VERSION"
fi

# Get repo info
REPO=$(git config --get remote.origin.url | sed 's/.*github.com[:/]\(.*\)\.git/\1/')
```

### Create Draft
```bash
gh release create "v$NEW_VERSION" \
  --draft \
  --title "v$NEW_VERSION" \
  --notes "$(cat <<EOF
## What's Changed

$CHANGELOG

**Full Changelog**: https://github.com/$REPO/$COMPARE_URL
EOF
)"
```

### Output
```
✓ GitHub draft release created
  • View: https://github.com/$REPO/releases
  • Edit draft and publish when ready
```
```

**Acceptance:**
- ✅ Detects previous tag
- ✅ Generates changelog from commits
- ✅ Creates GitHub draft
- ✅ Shows draft URL

### Task 2.6: Summary Report
**Time:** 5 min

Define final report template:
```markdown
## Summary Report

After successful release, show:
```
═══════════════════════════════════════
         RELEASE SUMMARY
═══════════════════════════════════════

Release Details:
  • Type: $RELEASE_TYPE
  • Previous version: $CURRENT_VERSION
  • New version: $NEW_VERSION
  • Branch: $CURRENT_BRANCH

Actions Taken:
  ✓ Version bumped in package.json
  ✓ Changes committed
  ✓ Tagged: v$NEW_VERSION
  [ SKIP_PUSH ? "○" : "✓" ] Pushed to remote
  [ DRAFT_CREATED ? "✓" : "○" ] GitHub draft created

Next Steps:
  1. Review GitHub draft release
  2. Add release notes if needed
  3. Publish draft when ready
  4. Announce to team

═══════════════════════════════════════
```
```

**Acceptance:**
- ✅ Shows all key information
- ✅ Clear action summary
- ✅ Helpful next steps

## Files Modified

**Created:**
- `~/.claude/skills/release-management/SKILL.md` (~300 lines)

## Flow Diagram

```
User invokes skill
  ↓
Parse args (type, dry-run, etc.)
  ↓
Validate project (package.json)
  ↓
Validate git (clean, branch)
  ↓
Get current state (version, branch)
  ↓
Calculate new version (preview)
  ↓
IF dry-run:
  → Show preview → Exit
ELSE:
  ↓
  Show diff? (AskUserQuestion)
  ↓
  Confirm push? (AskUserQuestion)
  ↓
  IF stable: Extra confirmation
  ↓
  Invoke release.sh with flags
  ↓
  Handle exit code
  ↓
  IF success:
    ↓
    Create GitHub draft? (AskUserQuestion)
    ↓
    Generate changelog
    ↓
    Create draft via gh
    ↓
    Show summary report
  ELSE:
    → Show error → Exit
```

## Testing Checklist

- [ ] Skill parses arguments correctly
- [ ] Project validation catches missing package.json
- [ ] Git validation catches uncommitted changes
- [ ] Branch validation catches wrong branch
- [ ] Shows current state clearly
- [ ] Dry-run mode shows preview
- [ ] Show diff prompts user
- [ ] Confirm push prompts user
- [ ] Stable release extra confirmation works
- [ ] Script invoked with correct flags
- [ ] Exit codes handled properly
- [ ] GitHub draft created successfully
- [ ] Changelog generated correctly
- [ ] Summary report clear and accurate

## Key Features

1. **Interactive** - Prompts at key decision points
2. **Safe** - Multiple confirmations, especially for stable
3. **Informative** - Clear output at every step
4. **Flexible** - Supports dry-run, skip-push, local-only
5. **Integrated** - Creates GitHub drafts automatically
6. **Recoverable** - Clear error messages, rollback on failure

## Next Phase

After Phase 2 complete and tested, proceed to Phase 3: Slash Command Updates.
