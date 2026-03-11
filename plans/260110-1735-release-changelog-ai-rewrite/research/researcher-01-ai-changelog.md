# AI-Powered Changelog Generation: Research Report

**Date:** 2026-01-10
**Context:** Generating GitHub Release Notes + CHANGELOG.md from Conventional Commits using Claude AI

---

## 1. LLM Prompt Engineering for Commit Rewriting

### Effective Prompt Structure
```
Role: Technical writer summarizing git changes for end users
Task: Rewrite commit messages into concise changelog entries
Constraints:
- Max 1-2 lines per entry
- Remove technical jargon (file names, internal references)
- Focus on user impact, not implementation
- Preserve scope if meaningful to users
- Use imperative mood ("Add feature" not "Added feature")
```

### Prompt Techniques
- **Few-shot examples**: Include 3-5 before/after pairs showing ideal transformations
- **Context injection**: Provide commit type mapping rules upfront
- **Batch processing**: Send commits grouped by category for consistency
- **Output format**: Request structured JSON or markdown for easy parsing
- **Hallucination prevention**: Instruct to skip commits if unclear, never invent details

### Sample Prompt Template
```
Rewrite these {type} commits into user-facing changelog entries:

Input format: <scope>: <original message>
Output format: - Brief description (1 line, imperative mood)

Rules:
- Remove technical details (file paths, variable names)
- Focus on user benefit or visible change
- Omit scope if not user-relevant
- Skip chore/build/ci unless impacts users

Commits:
{commit_list}
```

---

## 2. Keep a Changelog Standard Compliance

### Required Sections (keepachangelog.com)
1. **Added** - New features
2. **Changed** - Changes to existing functionality
3. **Deprecated** - Soon-to-be-removed features
4. **Removed** - Removed features
5. **Fixed** - Bug fixes
6. **Security** - Vulnerability fixes

### Format Structure
```markdown
## [Unreleased]

## [1.2.0] - 2026-01-10
### Added
- Feature description

### Fixed
- Bug fix description

### Changed
- Improvement description
```

### Best Practices
- **Unreleased section**: Always maintain at top for in-progress work
- **Reverse chronological**: Newest versions first
- **SemVer links**: Link version headers to GitHub compare URLs
- **Date format**: YYYY-MM-DD (ISO 8601)
- **Human-first**: Write for users, not developers
- **Grouping**: Breaking changes at top of version section

---

## 3. Conventional Commits to Changelog Mapping

### Standard Type Mapping
| Commit Type | Changelog Section | SemVer Impact | Include in Changelog |
|-------------|-------------------|---------------|---------------------|
| `feat` | Added | MINOR | ✅ Always |
| `fix` | Fixed | PATCH | ✅ Always |
| `perf` | Changed/Improved | PATCH | ✅ If notable |
| `refactor` | Changed | - | ⚠️ If user-facing |
| `docs` | Documentation | - | ⚠️ If user-facing |
| `style` | - | - | ❌ Skip |
| `test` | - | - | ❌ Skip |
| `build` | - | - | ❌ Skip |
| `ci` | - | - | ❌ Skip |
| `chore` | - | - | ❌ Skip |

### Custom Project Mapping (from context)
- **New Features** ← `feat`
- **Bug Fixes** ← `fix`
- **Improvements** ← `perf`, `refactor` (user-facing)
- **Documentation** ← `docs` (user-facing only)
- **Refactor** ← `refactor` (internal, optional)

### Scope Handling
- Extract scope from `type(scope): message` format
- Include in changelog if clarifies user-facing component (e.g., "terminal", "UI", "API")
- Omit internal scopes (e.g., "utils", "types", "config")
- Format: "**Component:** Description" or "[Component] Description"

---

## 4. Edge Cases & Handling Strategies

### Empty Categories
**Problem:** Section with no commits
**Solution:**
- Option A: Omit section entirely (cleaner)
- Option B: Show section with "No changes" (explicit)
- **Recommended:** Omit empty sections for conciseness

### Breaking Changes
**Detection:**
- `!` after type: `feat(api)!: change endpoint`
- Footer: `BREAKING CHANGE: description`

**Presentation:**
- Separate `### ⚠️ BREAKING CHANGES` section at top of version
- Or prefix entry with `**BREAKING:**` in relevant section
- Always include migration notes from commit body/footer

### Multiple Scopes
**Example:** `feat(ui,terminal): shared feature`
**Strategy:**
- Duplicate entry in both logical sections, OR
- Choose primary scope, OR
- Create combined entry under most relevant section

### Merge Commits
**Strategy:** Skip merge commits, only process feature branch commits
**Detection:** Exclude commits matching `^Merge (branch|pull request)`

### Version Commits
**Example:** `chore: bump version to 1.1.7`
**Strategy:** Always exclude from changelog (meta-operation)

### Non-Conventional Commits
**Fallback:**
- Prompt LLM to categorize based on keywords in message
- Default to "Other/Miscellaneous" section
- Flag for manual review in output

### Empty Descriptions
**Example:** `fix: ` (empty message)
**Strategy:**
- Skip entry entirely, OR
- Use commit body if available, OR
- Flag for manual review with `[REVIEW NEEDED]`

---

## 5. Implementation Recommendations

### Workflow
1. **Fetch commits**: `git log --format="%H|%s|%b" <prev_tag>..HEAD`
2. **Parse & filter**: Extract type, scope, description, body
3. **Group by type**: Create category buckets
4. **LLM rewrite**: Batch process per category (context efficiency)
5. **Format output**: Generate markdown following Keep a Changelog
6. **Manual review**: Present draft for final edits

### Prompt Optimization
- **Temperature**: 0.3-0.5 (balance creativity vs consistency)
- **Max tokens**: ~50 per entry (enforce brevity)
- **System prompt**: Define role as technical writer for end users
- **Retry logic**: If output too verbose, retry with stricter constraints

### Quality Checks
- Verify all commits processed (none lost)
- Check for duplicate entries
- Ensure imperative mood consistency
- Validate markdown formatting
- Flag suspiciously long entries (>2 lines)

### Tools Integration
- **Standard-version**: Auto-generates changelog, could feed to LLM for polish
- **Commitizen**: Ensures consistent commit format upstream
- **Semantic-release**: Full automation option (may bypass LLM step)

---

## 6. Output Format Examples

### GitHub Release Notes
```markdown
## 🎉 What's New
- Terminal auto-activates on project switch
- New Terminal button with redesigned empty state

## 🐛 Bug Fixes
- Fixed duplicate keyboard shortcuts issue
- Resolved async destruction in app quit handler

## 🔧 Improvements
- Integrated graceful+force kill fallback for terminal processes
```

### CHANGELOG.md Entry
```markdown
## [1.1.7] - 2026-01-10

### Added
- Terminal now auto-activates first instance on project switch
- New Terminal button with improved empty state design

### Fixed
- Duplicate keyboard shortcuts no longer registered
- App quit now properly destroys terminal processes

### Changed
- Terminal destruction uses async methods with graceful fallback
```

---

## Unresolved Questions
1. **Commit aggregation**: Should similar commits (e.g., 3 fixes in same component) be merged into one entry?
2. **Emoji usage**: GitHub releases vs CHANGELOG.md - same format or release-only emojis?
3. **Body content**: When to include commit body details vs just subject line?
4. **Versioning**: Should LLM suggest version bump (major/minor/patch) or just format?
5. **Multi-language**: Support for non-English commits or always output English?

---

## Sources
- [Keep a Changelog](https://keepachangelog.com/)
- [Conventional Commits Specification](https://www.conventionalcommits.org/)
- [Semantic Versioning](https://semver.org/)
- [Angular Commit Convention](https://github.com/angular/angular/blob/main/CONTRIBUTING.md)
