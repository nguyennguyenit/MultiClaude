# Phase 4: Documentation & Testing

**Status:** Pending
**Estimated Time:** 1 hour
**Dependency:** Phase 1, 2, 3 complete
**Files:**
- `~/.claude/skills/release-management/README.md` (create)
- `~/.claude/skills/release-management/references/version-schemes.md` (create)

## Objective

Create comprehensive documentation and perform thorough testing across all scenarios.

## Tasks Breakdown

### Task 4.1: README Documentation
**Time:** 25 min

**File:** `~/.claude/skills/release-management/README.md`

Create comprehensive guide:
```markdown
# Release Management Skill

Automated version releases for npm projects with support for beta and stable releases.

## Features

- ✅ Automatic version bumping (semver compliant)
- ✅ Git tagging and pushing
- ✅ Trap-based rollback on failure
- ✅ Dry-run mode for preview
- ✅ GitHub draft release creation
- ✅ Interactive confirmations
- ✅ Comprehensive validation
- ✅ Support for all package managers (npm, yarn, pnpm, bun)

## Installation

Already installed if you have Claude Code. Verify:
```bash
ls ~/.claude/skills/release-management/
```

## Quick Start

### Beta Release
```bash
# Preview changes
/release:beta --dry-run

# Execute release
/release:beta
```

### Stable Release
```bash
# Preview changes
/release:stable --dry-run

# Execute release (requires main/master branch)
/release:stable
```

## Usage

### Via Slash Commands (Recommended)

**Beta releases:**
```
/release:beta [--dry-run]
```

**Stable releases:**
```
/release:stable [--dry-run]
```

### Via Skill Tool

**Invoke directly:**
```
Skill: release-management
Args: --type=beta [--dry-run]
```

### Via Bash Script (Advanced)

**Direct script execution:**
```bash
~/.claude/skills/release-management/scripts/release.sh \
  --type=beta \
  [--dry-run] \
  [--skip-push] \
  [--no-tag] \
  [--verbose]
```

## Version Schemes

See [references/version-schemes.md](references/version-schemes.md) for details.

### Beta Releases

| Current Version | New Version | Description |
|-----------------|-------------|-------------|
| `1.1.6-beta.3` | `1.1.6-beta.4` | Increment beta number |
| `1.1.6` | `1.1.7-beta.1` | Start new beta cycle |

### Stable Releases

| Current Version | New Version | Description |
|-----------------|-------------|-------------|
| `1.1.6-beta.5` | `1.1.6` | Promote beta to stable |
| `1.1.6` | `1.1.7` | Patch bump |

## Branch Requirements

**Beta releases:**
- Must be on `beta` or `develop` branch

**Stable releases:**
- Must be on `main` or `master` branch

## Prerequisites

**Required:**
- Node.js project with `package.json`
- Git repository with clean working tree
- Remote repository configured

**Optional:**
- GitHub CLI (`gh`) for draft release creation

## Workflow

### Beta Release Workflow

1. Develop on `beta` branch
2. Run tests locally
3. Preview release: `/release:beta --dry-run`
4. Execute release: `/release:beta`
5. Review GitHub draft
6. Publish draft when ready

### Stable Release Workflow

1. Complete beta testing
2. Merge `beta` → `main` (via PR)
3. Switch to `main` branch
4. Preview release: `/release:stable --dry-run`
5. Execute release: `/release:stable`
6. Confirm production release
7. Review GitHub draft
8. Publish draft
9. Announce to team/users

## Script Flags

| Flag | Description |
|------|-------------|
| `--type=beta\|stable` | Release type (required) |
| `--dry-run` | Preview without changes |
| `--skip-push` | Local only, no remote push |
| `--no-tag` | Skip git tagging |
| `--verbose` | Debug output |
| `--lockfile=<path>` | Custom lockfile path |

## Error Handling

### Common Errors

**"Working tree has uncommitted changes"**
```bash
# Solution: Commit or stash changes
git status
git add .
git commit -m "Your message"
# Or
git stash
```

**"Must be on 'beta' or 'develop' branch"**
```bash
# Solution: Switch to correct branch
git checkout beta
```

**"Tag v1.1.6-beta.4 already exists"**
```bash
# Solution: Tag exists remotely
# Option 1: Skip this version, bump again
# Option 2: Delete tag if mistake
git tag -d v1.1.6-beta.4
git push origin :refs/tags/v1.1.6-beta.4
```

**"npm version failed"**
```bash
# Solution: Check package.json syntax
npm install  # Verify package.json valid
```

### Rollback

If release fails, rollback is automatic:
- Git tag deleted (if created)
- Git reset to previous commit
- Working tree restored

**Manual rollback (if needed):**
```bash
# Reset to previous commit
git reset --hard HEAD^

# Delete tag locally
git tag -d v1.1.6-beta.4

# Delete tag remotely (if pushed)
git push origin :refs/tags/v1.1.6-beta.4
```

## Customization

### Custom Lockfile
```bash
/release:beta
# Script auto-detects:
# - package-lock.json (npm)
# - yarn.lock (yarn)
# - pnpm-lock.yaml (pnpm)
# - bun.lockb (bun)

# Manual override:
~/.claude/skills/release-management/scripts/release.sh \
  --type=beta \
  --lockfile=custom-lock.json
```

### Skip Push (Local Only)
```bash
~/.claude/skills/release-management/scripts/release.sh \
  --type=beta \
  --skip-push
```

### Skip Tagging
```bash
~/.claude/skills/release-management/scripts/release.sh \
  --type=beta \
  --no-tag
```

## Troubleshooting

### Enable Verbose Mode
```bash
~/.claude/skills/release-management/scripts/release.sh \
  --type=beta \
  --verbose
```

### Check Script Permissions
```bash
ls -la ~/.claude/skills/release-management/scripts/release.sh
# Should be executable (-rwxr-xr-x)

# Fix if needed:
chmod +x ~/.claude/skills/release-management/scripts/release.sh
```

### Test in Isolation
```bash
# Create test repo
mkdir test-release && cd test-release
git init
npm init -y
git add . && git commit -m "init"

# Test dry-run
~/.claude/skills/release-management/scripts/release.sh \
  --type=beta \
  --dry-run
```

## Advanced Usage

### CI/CD Integration
```yaml
# .github/workflows/release.yml
name: Release
on:
  workflow_dispatch:
    inputs:
      type:
        description: 'Release type'
        required: true
        type: choice
        options:
          - beta
          - stable

jobs:
  release:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: 18
      - name: Release
        run: |
          ~/.claude/skills/release-management/scripts/release.sh \
            --type=${{ inputs.type }}
```

### Pre-release Hooks
Edit script to add hooks:
```bash
# Before version bump
pre_version_bump() {
  echo "Running tests..."
  npm test || exit 1
}

# After successful release
post_release() {
  echo "Notifying team..."
  curl -X POST https://hooks.slack.com/... -d '{"text":"Released v'$NEW_VERSION'"}'
}
```

## FAQ

**Q: Can I use this for alpha/rc releases?**
A: Not yet. Currently supports beta and stable only. Can be extended.

**Q: Does this work with monorepos?**
A: Yes, run from package directory with package.json.

**Q: Can I customize version bump logic?**
A: Yes, edit script's `calculate_new_version()` function.

**Q: What if I don't have GitHub CLI?**
A: Skill still works. Just skips draft creation. Manual: `gh release create v1.1.6 --draft`

**Q: Can I use this in other projects?**
A: Yes! Fully reusable. Just ensure project has package.json and git.

## Support

**Issues:**
Report at: https://github.com/nguyennguyenit/MultiClaude/issues

**Questions:**
Ask Claude: "How do I use the release-management skill for [scenario]?"

## License

Part of Claude Code project. See main LICENSE.

---

**Version:** 1.0.0
**Last Updated:** 2026-01-09
```

**Acceptance:**
- ✅ Comprehensive README
- ✅ All use cases documented
- ✅ Troubleshooting guide
- ✅ FAQ section
- ✅ Examples clear

### Task 4.2: Version Schemes Reference
**Time:** 10 min

**File:** `~/.claude/skills/release-management/references/version-schemes.md`

Document version bump logic:
```markdown
# Version Schemes Reference

## Semantic Versioning

This skill follows [Semantic Versioning 2.0.0](https://semver.org/).

Format: `MAJOR.MINOR.PATCH[-PRERELEASE]`

Example: `1.2.3-beta.4`
- MAJOR: 1
- MINOR: 2
- PATCH: 3
- PRERELEASE: beta.4

## Supported Release Types

### Beta Releases

Pre-release versions for testing before stable release.

**Format:** `x.y.z-beta.N`

**Branch:** `beta` or `develop`

**Bump Logic:**

| Current | New | Description |
|---------|-----|-------------|
| `1.1.6-beta.3` | `1.1.6-beta.4` | Increment beta number |
| `1.1.6` | `1.1.7-beta.1` | Start new beta cycle (patch bump) |
| `1.2.0` | `1.2.1-beta.1` | Start new beta cycle (patch bump) |

**Use Cases:**
- Feature development
- Bug fixes in testing
- Pre-production releases
- Continuous testing

### Stable Releases

Production-ready versions.

**Format:** `x.y.z`

**Branch:** `main` or `master`

**Bump Logic:**

| Current | New | Description |
|---------|-----|-------------|
| `1.1.6-beta.5` | `1.1.6` | Promote beta to stable (remove prerelease) |
| `1.1.6` | `1.1.7` | Patch bump |
| `1.2.0` | `1.2.1` | Patch bump |

**Use Cases:**
- Production releases
- Public releases
- Stable features
- Critical fixes

## Version Bump Rules

### Automatic Bumps (Current Implementation)

**Beta releases:**
- If current is beta: Increment beta number
- If current is stable: Increment patch, add `-beta.1`

**Stable releases:**
- If current is beta: Remove prerelease suffix
- If current is stable: Increment patch

### Manual Bumps (Future Enhancement)

For major/minor bumps, manually edit package.json before release:
```bash
# Manual major bump
npm version major --no-git-tag-version  # 1.1.6 → 2.0.0

# Then create beta
/release:beta  # 2.0.0 → 2.0.1-beta.1

# Or stable
/release:stable  # 2.0.0 → 2.0.1
```

## Version Constraints

**Valid versions:**
- `1.0.0` ✅
- `1.0.0-beta.1` ✅
- `2.5.10-beta.42` ✅

**Invalid versions:**
- `1.0` ❌ (missing patch)
- `1.0.0-alpha.1` ❌ (alpha not supported)
- `1.0.0-rc.1` ❌ (rc not supported)
- `v1.0.0` ❌ (no 'v' prefix in package.json)

## Git Tags

**Format:** `v{version}`

**Examples:**
- Package version: `1.1.6-beta.4`
- Git tag: `v1.1.6-beta.4`

**Tag creation:**
- Automatic during release
- Can be skipped with `--no-tag`
- Pushed to remote automatically

## Future Release Types

### Alpha Releases (Not Implemented)

**Format:** `x.y.z-alpha.N`

**Use case:** Very early testing, unstable

### Release Candidates (Not Implemented)

**Format:** `x.y.z-rc.N`

**Use case:** Final testing before stable

### Custom Prereleases (Not Implemented)

**Format:** `x.y.z-custom.N`

**Use case:** Special testing versions

## Implementation Notes

Version calculation logic in:
- **Bash script:** `~/.claude/skills/release-management/scripts/release.sh`
- **Function:** `calculate_new_version()`

```bash
calculate_new_version() {
  local current="$1"
  local type="$2"

  node -e "
    const v = '$current';
    const type = '$type';

    if (type === 'beta') {
      if (v.includes('-beta.')) {
        const [base, beta] = v.split('-beta.');
        console.log(base + '-beta.' + (parseInt(beta) + 1));
      } else if (/^\d+\.\d+\.\d+$/.test(v)) {
        const parts = v.split('.');
        parts[2] = parseInt(parts[2]) + 1;
        console.log(parts.join('.') + '-beta.1');
      }
    } else if (type === 'stable') {
      if (v.includes('-beta.')) {
        const [base] = v.split('-beta.');
        console.log(base);
      } else if (/^\d+\.\d+\.\d+$/.test(v)) {
        const parts = v.split('.');
        parts[2] = parseInt(parts[2]) + 1;
        console.log(parts.join('.'));
      }
    }
  "
}
```

To customize, edit this function.

---

**Reference:** [Semantic Versioning 2.0.0](https://semver.org/)
**Last Updated:** 2026-01-09
```

**Acceptance:**
- ✅ All version schemes documented
- ✅ Examples clear
- ✅ Future enhancements noted
- ✅ Implementation details included

### Task 4.3: Comprehensive Testing
**Time:** 25 min

Execute all test scenarios:

**Test Suite:**

```bash
#!/bin/bash
# test-release-management.sh

echo "Release Management Skill - Test Suite"
echo "======================================"

# Setup test repo
setup_test_repo() {
  local name=$1
  mkdir -p /tmp/test-release-$name
  cd /tmp/test-release-$name
  git init --initial-branch=beta
  npm init -y
  git add .
  git commit -m "Initial commit"
  echo "✓ Test repo created: $name"
}

cleanup_test_repo() {
  local name=$1
  rm -rf /tmp/test-release-$name
  echo "✓ Test repo cleaned: $name"
}

# Test 1: Beta bump (beta → beta)
test_beta_bump() {
  echo ""
  echo "Test 1: Beta bump (1.1.6-beta.3 → 1.1.6-beta.4)"
  setup_test_repo "beta-bump"

  # Set version
  npm version 1.1.6-beta.3 --no-git-tag-version
  git add . && git commit -m "Set version"

  # Dry run
  ~/.claude/skills/release-management/scripts/release.sh \
    --type=beta --dry-run

  # Execute
  ~/.claude/skills/release-management/scripts/release.sh \
    --type=beta --skip-push

  # Verify
  VERSION=$(node -p "require('./package.json').version")
  if [ "$VERSION" = "1.1.6-beta.4" ]; then
    echo "✓ PASS: Beta bump successful"
  else
    echo "✗ FAIL: Expected 1.1.6-beta.4, got $VERSION"
  fi

  cleanup_test_repo "beta-bump"
}

# Test 2: Stable to beta
test_stable_to_beta() {
  echo ""
  echo "Test 2: Stable to beta (1.1.6 → 1.1.7-beta.1)"
  setup_test_repo "stable-to-beta"

  # Set version
  npm version 1.1.6 --no-git-tag-version
  git add . && git commit -m "Set version"

  # Dry run
  ~/.claude/skills/release-management/scripts/release.sh \
    --type=beta --dry-run

  # Execute
  ~/.claude/skills/release-management/scripts/release.sh \
    --type=beta --skip-push

  # Verify
  VERSION=$(node -p "require('./package.json').version")
  if [ "$VERSION" = "1.1.7-beta.1" ]; then
    echo "✓ PASS: Stable to beta successful"
  else
    echo "✗ FAIL: Expected 1.1.7-beta.1, got $VERSION"
  fi

  cleanup_test_repo "stable-to-beta"
}

# Test 3: Beta to stable
test_beta_to_stable() {
  echo ""
  echo "Test 3: Beta to stable (1.1.6-beta.5 → 1.1.6)"
  setup_test_repo "beta-to-stable"

  # Switch to main
  git checkout -b main

  # Set version
  npm version 1.1.6-beta.5 --no-git-tag-version
  git add . && git commit -m "Set version"

  # Dry run
  ~/.claude/skills/release-management/scripts/release.sh \
    --type=stable --dry-run

  # Execute
  ~/.claude/skills/release-management/scripts/release.sh \
    --type=stable --skip-push

  # Verify
  VERSION=$(node -p "require('./package.json').version")
  if [ "$VERSION" = "1.1.6" ]; then
    echo "✓ PASS: Beta to stable successful"
  else
    echo "✗ FAIL: Expected 1.1.6, got $VERSION"
  fi

  cleanup_test_repo "beta-to-stable"
}

# Test 4: Rollback on failure
test_rollback() {
  echo ""
  echo "Test 4: Rollback on failure"
  setup_test_repo "rollback"

  # Set version
  npm version 1.1.6-beta.3 --no-git-tag-version
  git add . && git commit -m "Set version"

  PREV_COMMIT=$(git rev-parse HEAD)

  # Simulate failure by making push fail (no remote)
  ~/.claude/skills/release-management/scripts/release.sh \
    --type=beta 2>/dev/null || true

  CURR_COMMIT=$(git rev-parse HEAD)

  if [ "$PREV_COMMIT" = "$CURR_COMMIT" ]; then
    echo "✓ PASS: Rollback successful (commit unchanged)"
  else
    echo "✗ FAIL: Rollback failed (commit changed)"
  fi

  cleanup_test_repo "rollback"
}

# Test 5: Wrong branch error
test_wrong_branch() {
  echo ""
  echo "Test 5: Wrong branch error"
  setup_test_repo "wrong-branch"

  # Try stable on beta branch (should fail)
  ~/.claude/skills/release-management/scripts/release.sh \
    --type=stable --dry-run 2>&1 | grep -q "Error.*branch"

  if [ $? -eq 0 ]; then
    echo "✓ PASS: Wrong branch detected"
  else
    echo "✗ FAIL: Should reject stable on beta branch"
  fi

  cleanup_test_repo "wrong-branch"
}

# Test 6: Uncommitted changes error
test_uncommitted() {
  echo ""
  echo "Test 6: Uncommitted changes error"
  setup_test_repo "uncommitted"

  # Make uncommitted change
  echo "test" > test.txt

  ~/.claude/skills/release-management/scripts/release.sh \
    --type=beta --dry-run 2>&1 | grep -q "uncommitted"

  if [ $? -eq 0 ]; then
    echo "✓ PASS: Uncommitted changes detected"
  else
    echo "✗ FAIL: Should reject uncommitted changes"
  fi

  cleanup_test_repo "uncommitted"
}

# Run all tests
test_beta_bump
test_stable_to_beta
test_beta_to_stable
test_rollback
test_wrong_branch
test_uncommitted

echo ""
echo "======================================"
echo "Test Suite Complete"
echo "======================================"
```

**Acceptance:**
- ✅ All 6 tests pass
- ✅ Beta bump works
- ✅ Stable-to-beta works
- ✅ Beta-to-stable works
- ✅ Rollback works
- ✅ Validation errors caught

### Task 4.4: Integration Testing
**Time:** 15 min

Test on actual MultiClaude project:

**Test Checklist:**

```
Manual Testing on MultiClaude:

 [ ] 1. Dry-run beta release
       Command: /release:beta --dry-run
       Expected: Shows preview, no changes

 [ ] 2. Actual beta release
       Command: /release:beta
       Expected: Prompts, executes, creates draft

 [ ] 3. Verify version bumped in package.json
       Command: cat package.json | grep version

 [ ] 4. Verify git tag created
       Command: git tag -l | grep v1.1.6

 [ ] 5. Verify GitHub draft created
       URL: https://github.com/nguyennguyenit/MultiClaude/releases

 [ ] 6. Test rollback (simulate failure)
       Method: Disconnect network during push

 [ ] 7. Verify cross-project compatibility
       Test: Clone fresh repo, run release

 [ ] 8. Test with different package managers
       Test: yarn.lock, pnpm-lock.yaml, bun.lockb

 [ ] 9. Test stable release (on test branch)
       Setup: Create test-main branch
       Command: /release:stable --dry-run

 [ ] 10. Verify documentation accuracy
        Read: README.md
        Check: All examples work as documented
```

**Acceptance:**
- ✅ All manual tests pass
- ✅ Real project release successful
- ✅ GitHub draft created
- ✅ Documentation accurate

## Files Modified

**Created:**
- `~/.claude/skills/release-management/README.md` (~400 lines)
- `~/.claude/skills/release-management/references/version-schemes.md` (~200 lines)
- `/tmp/test-release-management.sh` (test suite, ~200 lines)

## Documentation Checklist

- [ ] README comprehensive
- [ ] All features documented
- [ ] Usage examples clear
- [ ] Troubleshooting guide complete
- [ ] FAQ addresses common questions
- [ ] Version schemes documented
- [ ] Customization guide included
- [ ] CI/CD integration example provided
- [ ] References to external docs included

## Testing Checklist

- [ ] Automated test suite created
- [ ] All test scenarios pass
- [ ] Beta releases work correctly
- [ ] Stable releases work correctly
- [ ] Rollback mechanism verified
- [ ] Error handling validated
- [ ] Cross-project compatibility confirmed
- [ ] Multiple package managers tested
- [ ] Real project release successful
- [ ] GitHub integration verified

## Deliverables

1. **README.md** - Complete usage documentation
2. **version-schemes.md** - Version bump logic reference
3. **test-release-management.sh** - Automated test suite
4. **Test results** - All tests passing
5. **Integration verification** - Real project release successful

## Success Criteria

✅ Documentation comprehensive and accurate
✅ All automated tests pass
✅ Manual integration tests pass
✅ Real project release successful
✅ Rollback verified working
✅ Error scenarios handled gracefully
✅ Cross-project compatibility confirmed

## Next Steps

After Phase 4 complete:
1. Update `~/.claude/README.md` with skill info
2. Announce new capability to team
3. Monitor first production uses
4. Gather feedback for improvements

---

**Phase Status:** Ready to execute
**Prerequisites:** Phase 1, 2, 3 complete and tested
