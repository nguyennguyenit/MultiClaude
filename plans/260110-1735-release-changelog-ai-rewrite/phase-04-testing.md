# Phase 4: Testing & Validation

## Context

- **Parent Plan:** [plan.md](./plan.md)
- **Dependencies:** Phase 1, 2, 3

## Overview

- **Priority:** P1
- **Status:** Pending
- **Effort:** 45m
- **Description:** Test the complete changelog generation flow

## Key Insights

1. Test with dry-run mode first (no side effects)
2. Validate parse-commits.sh output
3. Verify CHANGELOG.md format compliance
4. Check GitHub draft preview

## Requirements

### Functional
- parse-commits.sh produces valid JSON
- AI rewrites are concise
- CHANGELOG.md format matches Keep a Changelog
- GitHub draft includes changelog

### Non-Functional
- No regression in version bump logic
- Dry-run shows complete preview
- Error handling works correctly

## Test Cases

### Test 1: parse-commits.sh Unit Tests

```bash
# Test 1.1: Basic parsing
cd /path/to/test-repo
~/.claude/skills/release-management/scripts/parse-commits.sh --verbose

# Expected: JSON with categorized commits

# Test 1.2: Empty commit range
git tag -a v99.99.99 -m "test"
~/.claude/skills/release-management/scripts/parse-commits.sh --from-tag=v99.99.99

# Expected: Empty categories object

# Test 1.3: No previous tag
# In new repo without tags
~/.claude/skills/release-management/scripts/parse-commits.sh

# Expected: Last 20 commits parsed
```

### Test 2: Full Dry-Run Flow

```bash
# From beta branch
/release:beta --dry-run
```

**Expected output:**
```
═══════════════════════════════════════
           DRY RUN MODE
═══════════════════════════════════════

Would perform the following:
  • Release type: beta
  • Version bump: 1.1.6-beta.3 → 1.1.6-beta.4

Generated Changelog:
────────────────────────────────────────
## v1.1.6-beta.4 (2026-01-10)

### Bug Fixes
- Fix terminal auto-activation on project switch
- Resolve duplicate keyboard shortcuts

### Refactor
- Integrate async destruction for terminal processes
────────────────────────────────────────

Run without --dry-run to execute.
```

### Test 3: CHANGELOG.md Format

**Verify structure:**
```markdown
## v1.1.7 (2026-01-10)

### New Features
- Entry 1
- Entry 2

### Bug Fixes
- Entry 1

[Previous content preserved below...]
```

**Check:**
- [ ] No emoji in headers
- [ ] Date in YYYY-MM-DD format
- [ ] Empty sections omitted
- [ ] Previous content preserved

### Test 4: GitHub Draft Content

```bash
# After release, verify draft content
gh release view v1.1.7-beta.4 --json body
```

**Expected:** Same content as CHANGELOG.md entry

### Test 5: Edge Cases

| Scenario | Test | Expected |
|----------|------|----------|
| No feat commits | Release with only fixes | No "New Features" section |
| Non-conventional commit | `random message` | Skip (not included) |
| Breaking change | `feat!: breaking` | Standard format (no special section per requirements) |
| Very long message | 200+ char commit | Truncated by AI |

## Todo List

- [ ] Run parse-commits.sh unit tests
- [ ] Test dry-run flow
- [ ] Verify CHANGELOG.md format
- [ ] Check GitHub draft content
- [ ] Test edge cases
- [ ] Perform actual beta release (non-dry-run)

## Success Criteria

- [ ] All test cases pass
- [ ] No regressions in release flow
- [ ] Changelog format is correct
- [ ] AI rewrites are readable

## Risk Assessment

| Risk | Impact | Mitigation |
|------|--------|------------|
| AI output varies | Low | Use consistent prompts |
| Git state issues | Medium | Test on clean branch |

## Rollback Plan

If issues found:
1. Revert SKILL.md changes
2. Remove parse-commits.sh
3. Restore original allowed-tools in commands

## Next Steps

After testing:
1. Document any findings
2. Create additional edge case handling if needed
3. Mark plan as completed
