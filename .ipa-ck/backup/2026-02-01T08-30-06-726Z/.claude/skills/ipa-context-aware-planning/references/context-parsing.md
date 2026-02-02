# Context Reference Parsing

## Overview

Parse @path references from planning arguments, validate paths, categorize files.

## Syntax Reference

```
@path/to/folder    → Include entire folder recursively
@path/to/file.ext  → Include single file
@a @b @c           → Multiple space-separated refs
```

## Parsing Algorithm

### Step 1: Extract References

```
Regex: @([\w\-\./]+)
```

Example:
```
Input:  "implement login @docs/prototype/login more text @docs/api-specs"
Output: ["docs/prototype/login", "docs/api-specs"]
```

### Step 2: Validate Paths

For each extracted path:

1. Resolve relative to project root
2. Check existence:
   - If directory → mark as `type: directory`
   - If file → mark as `type: file`
   - If not exists → warn user, skip

```
Validation pseudocode:
for path in extracted_paths:
    full_path = resolve(project_root, path)
    if not exists(full_path):
        warn(f"Path not found: {path}, skipping")
        continue
    validated.append({path, type: dir|file})
```

### Step 3: Expand Directories

For each validated directory:

1. List files recursively
2. Exclude patterns:
   - Hidden files (`.*`)
   - `node_modules/`
   - `dist/`, `build/`
   - `.git/`
3. Respect file count limit (max 50)

```bash
# Equivalent command
find {path} -type f \
  -not -path "*/\.*" \
  -not -path "*/node_modules/*" \
  -not -path "*/dist/*" \
  | head -50
```

### Step 4: Categorize Files

| Category | Extensions | Handler |
|----------|------------|---------|
| design | `.html`, `.css`, `.js`, `.jsx`, `.tsx`, `.vue`, `.svelte` | → design-analysis.md |
| docs | `.md`, `.txt`, `.rst` | Read content as context |
| config | `.json`, `.yaml`, `.yml`, `.toml` | Read content as context |
| image | `.png`, `.jpg`, `.svg`, `.webp` | List path only |
| other | `*` | List path only |

### Step 5: Build Context Object

```yaml
context_refs:
  - path: "docs/prototype/login"
    type: directory
    files:
      design:
        - docs/prototype/login/login.html
        - docs/prototype/login/login.css
        - docs/prototype/login/login.js
      docs:
        - docs/prototype/login/README.md

  - path: "docs/api-specs"
    type: directory
    files:
      docs:
        - docs/api-specs/endpoints.md
        - docs/api-specs/auth.md

has_design: true   # triggers design-analysis
total_files: 7
```

## Integration

### If `has_design: true`
→ Activate `references/design-analysis.md`
→ Pass design files for visual + code analysis

### If `has_design: false`
→ Read docs/config files as context
→ Pass directly to planning workflow

## Error Handling

| Error | Response |
|-------|----------|
| Path not found | `⚠️ Path not found: {path}, skipping` |
| Permission denied | `⚠️ Cannot read: {path}, skipping` |
| Too many files | `⚠️ Found {n} files in {path}, limit is 50. Please narrow scope.` |
| No valid refs | `ℹ️ No valid @path references found, proceeding without context` |

## Security

- Paths must be within project directory
- No absolute paths starting with `/`
- No `..` parent traversal
- Skip symlinks

## Example Usage

```
Input: /plan:hard implement auth @docs/design/auth @docs/api/auth-spec.md

Parsed:
1. @docs/design/auth → directory
   - auth-login.html (design)
   - auth-login.css (design)
   - auth-register.html (design)

2. @docs/api/auth-spec.md → file
   - auth-spec.md (docs)

Result:
- has_design: true
- design files → design-analysis.md
- doc files → read as context
```
