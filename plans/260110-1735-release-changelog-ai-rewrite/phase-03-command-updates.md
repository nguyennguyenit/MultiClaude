# Phase 3: Command Updates

## Context

- **Parent Plan:** [plan.md](./plan.md)
- **Dependencies:** Phase 2 (SKILL.md update)

## Overview

- **Priority:** P1
- **Status:** Pending
- **Effort:** 30m
- **Description:** Update /release:beta and /release:stable commands for new changelog capabilities

## Key Insights

1. Commands need to allow new script and file operations
2. allowed-tools must include parse-commits.sh
3. Commands should mention changelog features in description

## Requirements

### Functional
- Update allowed-tools to include parse-commits.sh
- Add Write tool for CHANGELOG.md operations
- Update description to mention changelog features

### Non-Functional
- Maintain backward compatibility
- No breaking changes to existing flags

## Related Code Files

### Files to Modify
- `~/.claude/commands/release/beta.md`
- `~/.claude/commands/release/stable.md`

## Implementation Steps

### Step 1: Update beta.md

**Current allowed-tools:**
```yaml
allowed-tools: Bash($HOME/.claude/skills/release-management/scripts/release.sh *, git status *, git branch *, git tag *, git push *, git fetch *, git log *, gh release *), Read(package.json), AskUserQuestion
```

**New allowed-tools:**
```yaml
allowed-tools: Bash($HOME/.claude/skills/release-management/scripts/release.sh *, $HOME/.claude/skills/release-management/scripts/parse-commits.sh *, git status *, git branch *, git tag *, git push *, git fetch *, git log *, gh release *), Read(package.json, CHANGELOG.md), Write(CHANGELOG.md), Edit(CHANGELOG.md), AskUserQuestion
```

**Update description:**
```yaml
description: Release beta version with AI-generated changelog (auto bump, changelog, push)
```

### Step 2: Update stable.md

Same changes as beta.md:

**New allowed-tools:**
```yaml
allowed-tools: Bash($HOME/.claude/skills/release-management/scripts/release.sh *, $HOME/.claude/skills/release-management/scripts/parse-commits.sh *, git status *, git branch *, git tag *, git push *, git fetch *, git log *, gh release *), Read(package.json, CHANGELOG.md), Write(CHANGELOG.md), Edit(CHANGELOG.md), AskUserQuestion
```

**Update description:**
```yaml
description: Release stable version with AI-generated changelog (auto bump, changelog, push)
```

### Step 3: Add changelog section to Task description

Add to both commands after **Version bump logic:**

```markdown
**Changelog generation:**
- Parses Conventional Commits since last tag
- AI rewrites entries into user-facing descriptions
- Categories: New Features, Bug Fixes, Improvements, Documentation, Refactor
- Updates ./CHANGELOG.md (prepend new version)
- Includes in GitHub draft release
```

## Todo List

- [ ] Update beta.md allowed-tools
- [ ] Update beta.md description
- [ ] Add changelog section to beta.md
- [ ] Update stable.md allowed-tools
- [ ] Update stable.md description
- [ ] Add changelog section to stable.md
- [ ] Verify no syntax errors in frontmatter

## Success Criteria

- [ ] Both commands have parse-commits.sh in allowed-tools
- [ ] Both commands can write to CHANGELOG.md
- [ ] Descriptions mention changelog feature
- [ ] No YAML syntax errors

## Risk Assessment

| Risk | Impact | Mitigation |
|------|--------|------------|
| Tool permission issues | Low | Test with dry-run |
| YAML syntax error | Low | Validate frontmatter |

## Security Considerations

- CHANGELOG.md write permission is project-scoped
- No new security risks introduced

## Next Steps

After completion, proceed to Phase 4: Testing & Validation
