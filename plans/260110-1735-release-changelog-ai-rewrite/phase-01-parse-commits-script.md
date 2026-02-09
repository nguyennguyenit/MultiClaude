# Phase 1: Parse Commits Script

## Context

- **Parent Plan:** [plan.md](./plan.md)
- **Research:** [researcher-02-conventional-commits.md](./research/researcher-02-conventional-commits.md)

## Overview

- **Priority:** P1
- **Status:** Pending
- **Effort:** 45m
- **Description:** Create bash script to parse Conventional Commits and output structured data

## Key Insights

1. Use `git log --pretty=format:"%h|%s"` for simple pipe-delimited parsing
2. Bash regex can extract type, scope, message with `BASH_REMATCH`
3. Use associative arrays to accumulate entries by category
4. Filter with `--no-merges` and tag range

## Requirements

### Functional
- Parse commits between previous tag and HEAD
- Extract type, scope, message from Conventional Commit format
- Group commits by category (New Features, Bug Fixes, etc.)
- Output JSON format for AI processing

### Non-Functional
- Handle edge cases: missing scope, breaking changes, empty messages
- Skip ignored types (chore, ci, build, test, style)
- Ignore merge commits and version bump commits

## Architecture

```
git log → parse-commits.sh → JSON output
                                  ↓
                            {
                              "version": "1.1.7-beta.3",
                              "date": "2026-01-10",
                              "categories": {
                                "New Features": [...],
                                "Bug Fixes": [...],
                                ...
                              }
                            }
```

## Related Code Files

### Files to Create
- `~/.claude/skills/release-management/scripts/parse-commits.sh`

### Files to Reference
- `~/.claude/skills/release-management/scripts/release.sh` (existing patterns)

## Implementation Steps

### Step 1: Create script skeleton
```bash
#!/bin/bash
# Parse Conventional Commits for changelog generation
# Usage: parse-commits.sh [--from-tag=TAG]

set -e

FROM_TAG=""
VERBOSE=false

# Argument parsing
while [[ $# -gt 0 ]]; do
  case $1 in
    --from-tag=*) FROM_TAG="${1#*=}"; shift ;;
    --verbose) VERBOSE=true; shift ;;
    *) shift ;;
  esac
done
```

### Step 2: Detect previous tag
```bash
if [ -z "$FROM_TAG" ]; then
  FROM_TAG=$(git describe --tags --abbrev=0 HEAD^ 2>/dev/null || echo "")
fi

if [ -z "$FROM_TAG" ]; then
  # No previous tag, get last 20 commits
  RANGE="HEAD~20..HEAD"
else
  RANGE="${FROM_TAG}..HEAD"
fi
```

### Step 3: Parse commits with regex
```bash
# Initialize category arrays (bash 4+)
declare -A categories=(
  ["New Features"]=""
  ["Bug Fixes"]=""
  ["Improvements"]=""
  ["Documentation"]=""
  ["Refactor"]=""
)

# Parse each commit
while IFS='|' read -r hash subject; do
  # Skip merge and version commits
  [[ "$subject" =~ ^Merge ]] && continue
  [[ "$subject" =~ ^chore:\ bump\ version ]] && continue

  # Extract conventional commit parts
  if [[ "$subject" =~ ^(feat|fix|perf|improvement|docs|refactor|chore|ci|build|test|style)(\([^)]+\))?(!)?:[[:space:]]*(.+)$ ]]; then
    type="${BASH_REMATCH[1]}"
    scope="${BASH_REMATCH[2]}"
    breaking="${BASH_REMATCH[3]}"
    message="${BASH_REMATCH[4]}"

    # Remove parentheses from scope
    scope="${scope#(}"
    scope="${scope%)}"

    # Map type to category
    case "$type" in
      feat) cat="New Features" ;;
      fix) cat="Bug Fixes" ;;
      perf|improvement) cat="Improvements" ;;
      docs) cat="Documentation" ;;
      refactor) cat="Refactor" ;;
      *) continue ;;  # Skip ignored types
    esac

    # Build entry JSON
    entry="{\"hash\":\"$hash\",\"scope\":\"$scope\",\"message\":\"$message\",\"breaking\":$([ -n \"$breaking\" ] && echo true || echo false)}"

    # Append to category
    if [ -n "${categories[$cat]}" ]; then
      categories[$cat]+=","
    fi
    categories[$cat]+="$entry"
  fi
done < <(git log --pretty=format:"%h|%s" --no-merges $RANGE)
```

### Step 4: Output JSON
```bash
# Build JSON output
echo "{"
echo "  \"from_tag\": \"$FROM_TAG\","
echo "  \"categories\": {"

first=true
for cat in "New Features" "Bug Fixes" "Improvements" "Documentation" "Refactor"; do
  if [ -n "${categories[$cat]}" ]; then
    $first || echo ","
    first=false
    echo "    \"$cat\": [${categories[$cat]}]"
  fi
done

echo "  }"
echo "}"
```

### Step 5: Make executable
```bash
chmod +x ~/.claude/skills/release-management/scripts/parse-commits.sh
```

## Todo List

- [ ] Create parse-commits.sh with argument parsing
- [ ] Implement tag detection logic
- [ ] Add commit parsing with regex
- [ ] Implement category mapping
- [ ] Output JSON format
- [ ] Handle edge cases (empty, breaking changes)
- [ ] Test with actual git log output

## Success Criteria

- [ ] Script runs without errors on existing repo
- [ ] Correctly categorizes feat/fix/perf/docs/refactor commits
- [ ] Ignores chore/ci/build/test/style commits
- [ ] Outputs valid JSON with categories
- [ ] Handles missing previous tag gracefully

## Risk Assessment

| Risk | Impact | Mitigation |
|------|--------|------------|
| Bash 4+ requirement | Low | Check bash version, fallback |
| Non-conventional commits | Low | Skip with warning |
| Empty commit range | Low | Return empty categories |

## Security Considerations

- Escape special characters in commit messages for JSON
- No user input injection risk (git log output only)

## Next Steps

After completion, proceed to Phase 2: SKILL.md Changelog Flow
