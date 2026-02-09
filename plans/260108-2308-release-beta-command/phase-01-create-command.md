# Phase 01: Create Command File

## Context

- Parent: [plan.md](./plan.md)
- Target: `~/.claude/commands/release/beta.md`

## Overview

| Field | Value |
|-------|-------|
| Date | 2026-01-08 |
| Priority | P3 |
| Status | Completed |
| Effort | 30m |
| Completed | 2026-01-09 |

Create `/release:beta` slash command file with YAML frontmatter, context section, rules, and workflow steps.

## Key Insights

- Claude Code slash commands use `!` backticks for dynamic context injection
- `allowed-tools` restricts which tools the command can use
- npm version command handles package.json updates automatically

## Requirements

1. YAML frontmatter with description and allowed-tools
2. Context section with dynamic values (version, branch, git status)
3. Rules for validation (clean tree, branch check)
4. Version bump logic (stable→beta.1, beta.N→beta.N+1)
5. Workflow steps for full release cycle

## Architecture

```
~/.claude/commands/
└── release/
    └── beta.md    ← New file
```

## Related Code Files

- Reference: `~/.claude/commands/git/commit.md` (command structure example)
- Reference: `~/.claude/commands/git/pr.md` (workflow example)

## Implementation Steps

### Step 1: Create directory
```bash
mkdir -p ~/.claude/commands/release
```

### Step 2: Create beta.md with content

**YAML Frontmatter:**
```yaml
---
description: Release beta version (auto bump and push)
allowed-tools: Bash(npm *, node *, git *)
---
```

**Context Section:**
- Current version via node
- Current branch via git
- Working tree status

**Version Bump Logic:**
```javascript
// Pseudocode
if (version.includes('-beta.')) {
  // Extract N, increment: beta.N → beta.N+1
} else if (isStable(version)) {
  // Bump patch, add -beta.1
} else {
  // Reject (alpha, rc, etc.)
}
```

**Workflow:**
1. Validate clean working tree
2. Parse current version
3. Calculate new version
4. Run `npm version {new} --no-git-tag-version`
5. Commit: `chore: bump version to {new}`
6. Tag: `git tag v{new}`
7. Push: `git push origin HEAD --tags`

## Todo List

- [x] Create `~/.claude/commands/release/` directory
- [x] Write `beta.md` with full content
- [x] Test invocation with `/release:beta`

## Success Criteria

- [x] File exists at correct path
- [x] YAML frontmatter valid
- [x] Dynamic context works (`!` backticks)
- [x] All workflow steps documented

## Risk Assessment

| Risk | Impact | Mitigation |
|------|--------|------------|
| Uncommitted changes | Push fails | Validate clean tree first |
| Tag already exists | Git error | Check before creating |
| Network issues | Push fails | User can retry manually |

## Security Considerations

- Only pushes to `origin` (hardcoded)
- No credentials in command file
- Uses standard git/npm commands

## Next Steps

After implementation:
1. Test on MultiClaude project (current version 1.1.6-beta.2)
2. Expected result: 1.1.6-beta.3
3. Verify tag created and pushed

## Implementation Notes

**Completed 2026-01-09**

Created `~/.claude/commands/release/beta.md` with all planned features plus enhancements:

| Feature | Status |
|---------|--------|
| YAML frontmatter | Done |
| Dynamic context injection | Done |
| Version bump logic | Done |
| Workflow steps | Done |
| **Extras:** | |
| Dry-run mode (`--dry-run`) | Added |
| Trap-based rollback | Added |
| Multi-PM support (npm/yarn/pnpm/bun) | Added |
| Remote tag duplicate check | Added |
