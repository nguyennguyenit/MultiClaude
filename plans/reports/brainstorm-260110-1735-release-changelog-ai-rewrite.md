# Brainstorm: Release Changelog AI Rewrite

**Date:** 2026-01-10
**Status:** Approved
**Author:** Solution Brainstormer

---

## Problem Statement

Current `/release:beta` and `/release:stable` commands generate changelog from raw git commit messages. User wants:
- AI-powered rewrite of commit messages into concise descriptions
- Categorized output: New Features, Bug Fixes, Improvements, Documentation, Refactor
- Dual output: GitHub Release Notes + `./CHANGELOG.md`

## Requirements

| Requirement | Value |
|-------------|-------|
| Commit Format | Conventional Commits (feat:, fix:, docs:, etc.) |
| AI Processing | Claude rewrite for summarization |
| Output Targets | GitHub Draft Release + ./CHANGELOG.md |
| Categories | New Features, Bug Fixes, Improvements, Documentation, Refactor |
| Emoji Headers | No |

## Category Mapping

| Commit Prefix | Category |
|---------------|----------|
| `feat:` | New Features |
| `fix:` | Bug Fixes |
| `perf:`, `improvement:` | Improvements |
| `docs:` | Documentation |
| `refactor:` | Refactor |
| `chore:`, `ci:`, `build:`, `test:`, `style:` | *(Ignored)* |

## Proposed Architecture

```
Git Commits (conventional format)
        ↓
   [Parse Script]
   Group by type: feat:/fix:/docs:/perf:/refactor:
        ↓
   [Claude AI Rewrite]
   Summarize each category into concise bullets
        ↓
   [Output Generator]
        ├── GitHub Draft Release Notes
        └── ./CHANGELOG.md (prepend new version)
```

## Implementation Changes

### Files to Modify

1. **`~/.claude/skills/release-management/SKILL.md`**
   - Modify Step 7.3 to use new changelog generation flow
   - Add AI rewrite step before GitHub draft creation
   - Add CHANGELOG.md update step

2. **`~/.claude/commands/release/beta.md`**
   - Update allowed-tools for new capabilities

3. **`~/.claude/commands/release/stable.md`**
   - Same updates as beta.md

### New Files

1. **`~/.claude/skills/release-management/scripts/parse-commits.sh`**
   - Parse git log with conventional commit format
   - Group commits by type
   - Output structured JSON for AI processing

### Workflow Changes

**Current Step 7.3:**
```bash
CHANGELOG=$(git log $PREV_TAG..HEAD --oneline --pretty=format:"- %s (%h)")
```

**New Step 7.3:**
1. Parse commits using `parse-commits.sh`
2. Call Claude to rewrite each category
3. Generate formatted changelog
4. Create GitHub draft with rewritten notes
5. Prepend to ./CHANGELOG.md

## Output Format

```markdown
## v1.1.7-beta.3 (2026-01-10)

### New Features
- Add dark mode toggle to settings
- Implement user profile avatar upload

### Bug Fixes
- Fix login redirect loop on expired session

### Improvements
- Optimize image loading performance

### Documentation
- Update API authentication docs

### Refactor
- Restructure authentication module
```

## Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| AI inconsistency | Use clear prompt template with examples |
| Empty categories | Only render categories with content |
| CHANGELOG.md conflicts | Read existing, prepend new version |

## Success Criteria

- [ ] Changelog categorized correctly based on commit prefix
- [ ] AI rewrites are concise and meaningful
- [ ] Both GitHub release and CHANGELOG.md updated
- [ ] No regression in current release workflow

## Next Steps

1. Create implementation plan with detailed file changes
2. Implement parse-commits.sh script
3. Update SKILL.md with new changelog flow
4. Test with dry-run mode
5. Validate output quality

---

## Decision Log

| Decision | Rationale |
|----------|-----------|
| Use Conventional Commits parsing | Project already uses this format |
| AI rewrite instead of just grouping | More readable, professional changelog |
| Dual output (GitHub + CHANGELOG.md) | Complete documentation |
| No emoji in headers | User preference for clean format |
| Ignore chore/ci/build/test/style | Focus on user-facing changes |
