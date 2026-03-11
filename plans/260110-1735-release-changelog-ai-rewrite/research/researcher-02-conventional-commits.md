# Conventional Commits Parsing & CHANGELOG Management Research

**Research Date:** 2026-01-10
**Researcher:** a47b304

---

## 1. Git Log Format for Conventional Commits

### Optimal Format String
```bash
git log --pretty=format:"%H%n%s%n%b%n---END---"
```

**Key components:**
- `%H` - Full commit hash (for linking/tracking)
- `%s` - Subject line (contains type, scope, message)
- `%b` - Body (breaking changes, additional context)
- Custom delimiter `---END---` for multi-line parsing

### Alternative Single-Line Format
```bash
git log --pretty=format:"%h|%s" --no-merges
```
- Simpler for basic categorization
- `%h` - Short hash
- `|` delimiter for easy splitting

### Filtering Options
```bash
# Between tags
git log v1.0.0..v2.0.0 --no-merges

# Since last tag
git log $(git describe --tags --abbrev=0)..HEAD --no-merges

# Date range
git log --since="2026-01-01" --no-merges
```

---

## 2. Bash Regex Patterns

### Extract Type, Scope, Message

**Pattern 1: Basic Conventional Commit**
```bash
# Regex: ^(feat|fix|perf|docs|refactor|chore|ci|build|test|style|improvement)(\([^)]+\))?(!)?:\s*(.+)$

# Example parsing:
if [[ "$subject" =~ ^(feat|fix|perf|docs|refactor|chore|ci|build|test|style|improvement)(\([^)]+\))?(!)?:[[:space:]]*(.+)$ ]]; then
  type="${BASH_REMATCH[1]}"
  scope="${BASH_REMATCH[2]#(}"  # Remove leading (
  scope="${scope%\)}"            # Remove trailing )
  breaking="${BASH_REMATCH[3]}"
  message="${BASH_REMATCH[4]}"
fi
```

**Pattern 2: Breaking Change Detection**
```bash
# Subject ends with !
[[ "$subject" =~ !:[[:space:]] ]]

# Body contains BREAKING CHANGE:
[[ "$body" =~ BREAKING[[:space:]]CHANGE:[[:space:]](.+) ]]
```

**Pattern 3: Issue/PR References**
```bash
# Extract #123, (#456)
[[ "$message" =~ \(#([0-9]+)\) ]] && pr="${BASH_REMATCH[1]}"
[[ "$message" =~ #([0-9]+) ]] && issue="${BASH_REMATCH[1]}"
```

### Category Mapping Implementation
```bash
case "$type" in
  feat)
    category="New Features"
    ;;
  fix)
    category="Bug Fixes"
    ;;
  perf|improvement)
    category="Improvements"
    ;;
  docs)
    category="Documentation"
    ;;
  refactor)
    category="Refactor"
    ;;
  chore|ci|build|test|style)
    # Ignored - skip
    continue
    ;;
esac
```

---

## 3. CHANGELOG.md Prepend Strategies

### Best Practice: Temp File Method
```bash
# 1. Generate new version content
new_content="## [1.2.0] - 2026-01-10\n..."

# 2. Create temp file with new content + existing
{
  echo -e "$new_content"
  echo ""  # Blank line separator
  cat CHANGELOG.md
} > CHANGELOG.tmp

# 3. Atomic replace
mv CHANGELOG.tmp CHANGELOG.md
```

**Advantages:**
- Atomic operation (mv is atomic on same filesystem)
- Preserves existing content
- No race conditions

### Alternative: sed In-Place
```bash
# Insert after specific line (e.g., after header)
sed -i "/^# Changelog/a\\
\\
## [1.2.0] - 2026-01-10\\
..." CHANGELOG.md
```

**Note:** Less reliable for complex multi-line inserts.

### Keep-a-Changelog Format Structure
```markdown
# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

## [1.2.0] - 2026-01-10

### New Features
- feat(auth): add OAuth2 support (#123)

### Bug Fixes
- fix(api): handle timeout errors correctly

### BREAKING CHANGES
- API endpoint `/v1/users` renamed to `/v2/users`

## [1.1.0] - 2026-01-05
...
```

---

## 4. Existing Tools Reference (Not to Use, For Pattern Learning)

### conventional-changelog
- Uses `git log --format='%B%n-hash-%n%H%n-gitTags-%n%d%n-committerDate-%n%ci%n-authorName-%n%aN'`
- Parses with JavaScript regex: `/^(\w*)(?:\((.*)\))?!?: (.*)$/`
- Groups by type, sorts by scope

### git-cliff
- Uses Rust regex: `r"^(?P<type>\w+)(\((?P<scope>[\w\-]+)\))?(?P<breaking>!)?:\s(?P<description>.*)"`
- Template-based output (Tera templates)
- Automatic link generation: `[abc1234](https://github.com/user/repo/commit/abc1234)`

### Common Patterns Observed
1. **Always filter merge commits**: `--no-merges`
2. **Reverse chronological order**: Most recent first
3. **Link commits**: `[${short_hash}](${repo_url}/commit/${hash})`
4. **Breaking changes**: Separate section at top
5. **Scope formatting**: Show scope in parentheses when present

---

## 5. Implementation Recommendations

### Parsing Pipeline
```bash
#!/bin/bash
declare -A categories=(
  ["New Features"]=""
  ["Bug Fixes"]=""
  ["Improvements"]=""
  ["Documentation"]=""
  ["Refactor"]=""
)

while IFS='|' read -r hash subject; do
  if [[ "$subject" =~ ^(feat|fix|perf|improvement|docs|refactor)(\([^)]+\))?:[[:space:]]*(.+)$ ]]; then
    type="${BASH_REMATCH[1]}"
    scope="${BASH_REMATCH[2]}"
    msg="${BASH_REMATCH[3]}"

    # Map type to category
    case "$type" in
      feat) cat="New Features" ;;
      fix) cat="Bug Fixes" ;;
      perf|improvement) cat="Improvements" ;;
      docs) cat="Documentation" ;;
      refactor) cat="Refactor" ;;
      *) continue ;;
    esac

    # Format entry
    scope_str=""
    [[ -n "$scope" ]] && scope_str="**${scope}** "
    entry="- ${scope_str}${msg} ([${hash:0:7}](commit/${hash}))"

    categories[$cat]+="$entry\n"
  fi
done < <(git log --pretty=format:"%h|%s" --no-merges "$from_tag..HEAD")
```

### CHANGELOG Generation Template
```bash
output="## [$version] - $(date +%Y-%m-%d)\n\n"

for category in "New Features" "Bug Fixes" "Improvements" "Documentation" "Refactor"; do
  if [[ -n "${categories[$category]}" ]]; then
    output+="### $category\n"
    output+="${categories[$category]}\n"
  fi
done

# Prepend to CHANGELOG
{
  echo -e "$output"
  cat CHANGELOG.md
} > CHANGELOG.tmp && mv CHANGELOG.tmp CHANGELOG.md
```

---

## Key Takeaways

1. **Git log format**: Use `--pretty=format:"%h|%s"` for simple parsing
2. **Regex**: `^(type)(\(scope\))?:\s*(.+)$` covers 95% of cases
3. **Prepend**: Temp file + atomic mv is safest
4. **Categories**: Use associative array to accumulate entries
5. **Links**: Include short hash with markdown link format

---

## Unresolved Questions

None - requirements are clear and well-supported by existing patterns.
