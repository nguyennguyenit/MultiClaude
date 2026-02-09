# Phase 2: SKILL.md Changelog Flow Update

## Context

- **Parent Plan:** [plan.md](./plan.md)
- **Research:** [researcher-01-ai-changelog.md](./research/researcher-01-ai-changelog.md)
- **Dependencies:** Phase 1 (parse-commits.sh)

## Overview

- **Priority:** P1
- **Status:** Done
- **Effort:** 1h
- **Completed:** 2026-01-11
- **Description:** Update SKILL.md Step 7.3 to use AI-powered changelog generation

## Key Insights

1. Use role-based prompts (technical writer for end users)
2. Batch by category for context efficiency
3. Temperature 0.3-0.5 for consistency
4. Omit empty categories
5. Prepend to CHANGELOG.md atomically

## Requirements

### Functional
- Parse commits using new script (Phase 1)
- Use Claude to rewrite each category
- Generate markdown for GitHub draft
- Prepend new version to ./CHANGELOG.md
- Show changelog preview in dry-run mode

### Non-Functional
- AI rewrites must be concise (1-2 lines each)
- Follow Keep a Changelog format
- No emoji in headers (per user preference)

## Architecture

```
Step 7.3 Flow:

  parse-commits.sh → JSON categories
         ↓
  Claude AI Rewrite (per category)
         ↓
  Format Markdown
         ↓
  ├── GitHub Draft Release (gh release create)
  └── ./CHANGELOG.md (prepend)
```

## Related Code Files

### Files to Modify
- `~/.claude/skills/release-management/SKILL.md` (Step 7.3)

### Files to Reference
- `~/.claude/skills/release-management/scripts/parse-commits.sh` (Phase 1)

## Implementation Steps

### Step 1: Replace Step 7.3 in SKILL.md

**Current Step 7.3:**
```bash
CHANGELOG=$(git log $PREV_TAG..HEAD --oneline --pretty=format:"- %s (%h)")
```

**New Step 7.3:**
```markdown
### 7.3 Generate AI-Rewritten Changelog

#### 7.3.1 Parse Commits
Run commit parser to get categorized commits:
\```bash
COMMITS_JSON=$($HOME/.claude/skills/release-management/scripts/parse-commits.sh --from-tag="$PREV_TAG")
\```

#### 7.3.2 AI Rewrite Each Category
For each non-empty category in COMMITS_JSON, use Claude to rewrite:

**Prompt Template:**
\```
You are a technical writer creating changelog entries for end users.

Rewrite these {category} commits into concise changelog entries:
- Max 1 line per entry
- Use imperative mood ("Add" not "Added")
- Focus on user impact, not implementation details
- Remove technical jargon (file names, internal references)
- If scope is user-relevant (UI, terminal, API), include it

Input commits:
{commits_json}

Output format (one per line):
- Brief description
- Another description
\```

**Example:**
Input:
- `fix(terminal): resolve WebGL context lost on resize`
- `fix(terminal): prevent double destroy calls`

Output:
- Fix terminal display corruption on window resize
- Prevent terminal crashes during rapid close operations

#### 7.3.3 Format Changelog Markdown
Build changelog using rewritten entries:

\```markdown
## v{NEW_VERSION} ({DATE})

### New Features
{ai_rewritten_feat_entries}

### Bug Fixes
{ai_rewritten_fix_entries}

### Improvements
{ai_rewritten_improvements_entries}

### Documentation
{ai_rewritten_docs_entries}

### Refactor
{ai_rewritten_refactor_entries}
\```

**Rules:**
- Omit empty sections entirely
- No emoji in headers
- Date format: YYYY-MM-DD

#### 7.3.4 Preview in Dry-Run
If DRY_RUN, show generated changelog and exit.
```

### Step 2: Add Step 7.4 - Update CHANGELOG.md

```markdown
### 7.4 Update CHANGELOG.md

IF ./CHANGELOG.md exists:
\```bash
# Prepend new version to CHANGELOG.md
{
  echo -e "$CHANGELOG_CONTENT"
  echo ""
  cat ./CHANGELOG.md
} > CHANGELOG.tmp && mv CHANGELOG.tmp ./CHANGELOG.md

log_verbose "✓ Updated CHANGELOG.md"
\```

IF ./CHANGELOG.md does NOT exist:
\```bash
# Create new CHANGELOG.md with header
cat > ./CHANGELOG.md << 'HEADER'
# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

HEADER

echo -e "$CHANGELOG_CONTENT" >> ./CHANGELOG.md

log_verbose "✓ Created CHANGELOG.md"
\```
```

### Step 3: Update Step 7.5 - GitHub Draft with New Changelog

Update existing GitHub draft creation to use `$CHANGELOG_CONTENT`:

```markdown
### 7.5 Create GitHub Draft Release (formerly 7.3)

\```bash
if gh release create "v$NEW_VERSION" \
  --draft \
  --title "v$NEW_VERSION" \
  --notes "$CHANGELOG_CONTENT"; then
  DRAFT_CREATED=true
else
  DRAFT_CREATED=false
fi
\```
```

### Step 4: Update Summary Report

Add CHANGELOG.md status to Step 8 summary:
```
Actions:
  [x] Version bumped (package.json)
  [x] Committed
  [x] Tagged: v$NEW_VERSION
  [ SKIP_PUSH ? "[ ]" : "[x]" ] Pushed to remote
  [ DRAFT_CREATED ? "[x]" : "[ ]" ] GitHub draft
  [x] CHANGELOG.md updated
```

## Todo List

- [x] Replace Step 7.3 with new changelog flow
- [x] Add Step 7.3.1: Parse commits
- [x] Add Step 7.3.2: AI rewrite with prompt template
- [x] Add Step 7.3.3: Format markdown
- [x] Add Step 7.3.4: Dry-run preview
- [x] Add Step 7.4: CHANGELOG.md update
- [x] Update Step 7.5: GitHub draft with new content
- [x] Update Step 8: Summary report

## Success Criteria

- [x] AI rewrites are concise and readable
- [x] Empty categories omitted
- [x] CHANGELOG.md prepended correctly
- [x] GitHub draft uses new format
- [x] Dry-run shows changelog preview

## Risk Assessment

| Risk | Impact | Mitigation |
|------|--------|------------|
| AI output inconsistency | Medium | Use low temperature, clear constraints |
| Long changelogs | Low | Limit to last 50 commits |
| CHANGELOG.md format conflict | Low | Use standard Keep a Changelog format |

## Security Considerations

- Sanitize commit messages before AI processing
- No sensitive data in changelog entries

## Next Steps

After completion, proceed to Phase 3: Command Updates
