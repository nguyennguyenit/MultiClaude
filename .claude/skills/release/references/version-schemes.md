# Version Schemes Reference

## Beta Releases (`/release:beta`)

| Current Version | Result |
|----------------|--------|
| `3.0.0-beta.1` | `3.0.0-beta.2` (bump beta number) |
| `3.0.0-beta.9` | `3.0.0-beta.10` |
| `3.0.0` | `3.0.1-beta.1` (patch bump + beta.1) |
| `2.5.3` | `2.5.4-beta.1` |

## Stable Releases (`/release:main`)

| Current Version | Strategy | Result |
|----------------|----------|--------|
| `3.0.0-beta.5` | Strip beta (default) | `3.0.0` |
| `3.0.0-beta.5` | Bump patch | `3.0.1` |
| `3.0.0-beta.5` | Bump minor | `3.1.0` |
| `3.0.0-beta.5` | Bump major | `4.0.0` |
| `3.0.0-beta.5` | Custom | User-provided semver |
| `3.0.0` | Bump patch | `3.0.1` |

## Version Conflict Resolution

When beta base version <= latest stable tag on default branch:

| Stable | Beta Current | Conflict? | Patch Result | Minor Result | Major Result |
|--------|-------------|-----------|--------------|--------------|--------------|
| `3.0.0` | `3.0.0-beta.2` | Yes | `3.0.1-beta.1` | `3.1.0-beta.1` | `4.0.0-beta.1` |
| `3.0.0` | `2.9.5-beta.3` | Yes | `3.0.1-beta.1` | `3.1.0-beta.1` | `4.0.0-beta.1` |
| `3.0.0` | `3.1.0-beta.1` | No | `3.1.0-beta.2` (normal) | — | — |

### Default Branch Detection

Combo fallback (no config needed):
1. `git symbolic-ref refs/remotes/origin/HEAD`
2. `gh repo view --json defaultBranchRef`
3. Check for `main` or `master` branch

## Conventions

- Tags prefixed with `v`: `v3.0.0-beta.2`
- Beta releases: `--prerelease` flag on GitHub Release
- Stable releases: full GitHub Release (not draft)
- CI triggers on tag push matching `v*`
