---
name: release
description: "Release automation with version bump, AI changelog, GitHub Release. Multi-project compatible."
argument-hint: "[branch-name] [--dry-run]"
version: 1.1.0
---

# Release Skill

Automates version bumping, git tagging, AI changelog generation, and GitHub Release creation.
Works with any project that has a `package.json`.

**Base directory:** `.claude/skills/release`

## Arguments

Parse `ARGUMENTS` for branch and flags:
- First word (not a flag): target branch name (e.g. `beta`, `staging`, `dev`)
- `--dry-run` → preview only
- If no branch specified: use `AskUserQuestion` to let user pick from available branches

## Branch Detection

When no branch is specified, detect available branches and suggest:
```bash
git branch --list --format='%(refname:short)'
```
Present branches via `AskUserQuestion` with current branch pre-selected.

## Release Type Detection

Determine release type from branch context (no hardcoded names):
- If current branch version in package.json contains `-beta` or `-alpha` or `-rc` → **pre-release**
- If merging to default branch (main/master) → **stable release**
- Otherwise → ask user: "Pre-release or stable?"

## Flow

### Step 1: Validate
- Confirm `package.json` exists
- Check current branch matches target (or offer to checkout)

### Step 2: Handle Dirty Tree
If working tree not clean, use `AskUserQuestion`:
- "Stash changes and release" → `git stash -u`, release, `git stash pop`
- "Commit first" → let user commit, then continue
- "Cancel" → abort

### Step 3: Preview
Run `bash .claude/skills/release/scripts/release.sh --type=<beta|stable> --dry-run`
Show output to user.

### Step 3.5: Handle Version Conflict (Beta only)

If dry-run exits with code 10, parse output for `BUMP_CONFLICT|<stable_version>|<beta_base>`:

Use `AskUserQuestion`:
- Header: "Version Conflict"
- Question: "Default branch already released v{stable_version}. Beta base v{beta_base} needs rebump. Choose bump type:"
- Options:
  - "Patch ({stable}.patch+1-beta.1)" (Recommended)
  - "Minor ({stable}.minor+1.0-beta.1)"
  - "Major ({stable}.major+1.0.0-beta.1)"

Then re-run with `--bump=<selected>` flag.

### Step 4: Confirm
Use `AskUserQuestion`: "Proceed with release vX.Y.Z?"
- "Yes, release" / "Dry-run only (done)" / "Cancel"

### Step 5: Execute Release
Run `bash .claude/skills/release/scripts/release.sh --type=<beta|stable>`

### Step 6: Changelog
1. Run `bash .claude/skills/release/scripts/parse-commits.sh` (auto-detects from last tag)
2. For full changelog: `parse-commits.sh --from-tag=LAST_STABLE_TAG`
   - Find last stable: `git tag -l 'v*' --sort=-v:refname | grep -v -E 'beta|alpha|rc' | head -1`

### Step 7: AI Rewrite
Rewrite parsed commits into user-facing changelog:
- Group by category (already grouped)
- Rewrite each entry to describe user benefit, not code change
- Bold scope prefix: **Terminal:** description
- Mark breaking: **BREAKING:** description
- 1 line per entry, no jargon
- Fallback: use raw parsed commits if rewrite fails

### Step 8: Custom Notes
Use `AskUserQuestion`: "Add custom release notes? (bug fixes, manual changes not in commits)"
- If user provides text → prepend/append to changelog
- If skip → continue

### Step 9: GitHub Release
Detect repo URL: `git remote get-url origin`
Auto-append Full Changelog link:
```
**Full Changelog**: https://github.com/OWNER/REPO/compare/OLD_TAG...NEW_TAG
```

Always create as draft: `gh release create --draft`
For pre-releases: add `--prerelease` flag
User publishes manually when ready.

If `gh` not installed → warn and skip.

### Step 10: CI/CD Status
Check if workflows exist: `gh workflow list`
- If yes → show latest run status: `gh run list --limit 2`
- If no → skip silently

### Step 11: Summary
Print release summary with version, tag, branch, GitHub Release URL.

## Stable Release (merge flow)

When releasing to default branch (main/master):
1. Show merge preview: `git log <default>..HEAD --oneline`
2. Confirm merge
3. `git checkout <default> && git pull origin <default>`
4. `git merge <source> --no-ff`
5. Run release.sh
6. Offer to switch back to source branch

## Error Handling

| Error | Action |
|-------|--------|
| Wrong branch | Show current, suggest checkout |
| Dirty tree | Offer stash/commit/cancel |
| Merge conflicts | Abort merge, show files, suggest manual fix |
| Tag exists | Show existing tag info |
| `gh` not installed | Skip GitHub Release, warn |
| Push failed | Show error, local tag+commit remain |
| Version mismatch | Show mismatch, suggest sync command |
| Bump conflict (exit 10) | Beta base <= stable; prompt user for bump type |

## References

- `references/version-schemes.md` - Version bump rules
