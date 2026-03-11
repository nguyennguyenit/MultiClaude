# Brainstorm: Beta Release Command

## Problem Statement

Cần tạo slash command chuyên dùng để release phiên bản beta:
- `1.1.5` (stable) → `1.1.6-beta.1` (new beta)
- `1.1.6-beta.1` → `1.1.6-beta.2` (bump beta number)

## Requirements

| Requirement | Value |
|-------------|-------|
| Type | Slash Command |
| Invocation | `/release:beta` |
| Arguments | None (auto-detect) |
| Workflow | Bump → Commit → Tag → Push |
| Commit format | `chore: bump version to X.Y.Z-beta.N` |

## Evaluated Approaches

### 1. Slash Command (Selected ✓)

**Pros:**
- Simple single-file structure
- Easy to maintain
- Directly leverages git/npm bash commands
- No external scripts needed

**Cons:**
- Logic embedded in markdown, less testable

### 2. Skill with Python Script

**Pros:**
- Testable versioning logic
- Could be reused across projects

**Cons:**
- Overkill for this simple workflow
- More complex structure (folder + SKILL.md + scripts)
- Needs dependency management

## Final Solution

### File Structure
```
~/.claude/commands/release/
└── beta.md
```

### Version Bump Logic
```
1. Read version from package.json
2. Parse version:
   - If contains "-beta.N": extract base and N, increment N
   - If stable (no prerelease): bump patch, add "-beta.1"
3. Update package.json (and package-lock.json if exists)
4. Git operations: commit → tag → push
```

### Examples

| Before | After |
|--------|-------|
| `1.1.5` | `1.1.6-beta.1` |
| `1.1.6-beta.1` | `1.1.6-beta.2` |
| `1.1.6-beta.9` | `1.1.6-beta.10` |
| `2.0.0-alpha.1` | (Error: only beta supported) |

### Command Content

```markdown
---
description: Release beta version (auto bump and push)
allowed-tools: Bash(npm *, node *, git *)
---

## Context
- Current version: !`node -p "require('./package.json').version"`
- Current branch: !`git branch --show-current`
- Working tree clean: !`git status --porcelain | wc -l`

## Rules
1. Only run on clean working tree (no uncommitted changes)
2. Must be on 'beta' or 'develop' branch (configurable)
3. Auto-detect current version and bump appropriately

## Version Bump Logic
- If version ends with `-beta.N`: increment N
- If stable version (no prerelease): bump patch, add `-beta.1`
- Reject other prerelease formats (alpha, rc, etc.)

## Workflow
1. Validate: clean tree, correct branch
2. Calculate new version
3. Update package.json and package-lock.json using npm version
4. Commit with message: `chore: bump version to {new_version}`
5. Create git tag: `v{new_version}`
6. Push commit and tags to origin
7. Show confirmation with new version

## Commands Reference
- Bump prerelease: `npm version prerelease --preid=beta`
- Or manual: `npm version {new_version} --no-git-tag-version`
- Git tag: `git tag v{version}`
- Push with tags: `git push origin HEAD --tags`
```

## Implementation Considerations

### Edge Cases
- **Uncommitted changes:** Abort with warning
- **Wrong branch:** Warn but allow with confirmation
- **Network issues:** Retry push logic
- **package-lock.json missing:** Only update package.json

### Risks
| Risk | Mitigation |
|------|------------|
| Accidental push to wrong remote | Hardcode `origin` as default |
| Version collision | Check if tag exists before creating |
| package.json parse error | Use `node -p` for reliable JSON parsing |

## Success Metrics

- [x] Auto-detect stable vs beta version
- [x] Increment beta number correctly
- [x] Create proper git tag
- [x] Push to remote
- [x] No manual intervention required

## Next Steps

1. Create `~/.claude/commands/release/` directory
2. Write `beta.md` command file
3. Test with dry-run first
4. Verify on current MultiClaude project
