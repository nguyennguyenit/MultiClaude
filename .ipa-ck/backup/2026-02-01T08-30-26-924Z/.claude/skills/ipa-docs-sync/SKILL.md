---
name: ipa-docs:sync
description: Sync IPA docs (API_SPEC, DB_DESIGN, UI_SPEC) with actual implementation
user-invocable: true
argument-hint: "[all | api | db | ui]"
---

## Purpose

Sync IPA-generated documentation with actual implementation after /code completion.

---

## Docs to Sync

| Doc | Sync From | When |
|-----|-----------|------|
| `docs/API_SPEC.md` | Actual API endpoints in codebase | After BE tasks |
| `docs/DB_DESIGN.md` | Actual database schema | After BE tasks |
| `docs/UI_SPEC.md` | Actual UI components | After FE tasks (if changed) |

---

## Workflow

### Step 1: Detect Changes

1. Read current `docs/API_SPEC.md`
2. Scan codebase for actual API endpoints:
   - Look for route definitions (Express, NestJS, FastAPI, etc.)
   - Extract request/response types
3. Compare and identify differences

### Step 2: Update API_SPEC.md

If differences found:
1. Update endpoint list
2. Update request/response schemas
3. Update error codes
4. **Update Endpoint Matrix Status column:**
   - ⏳ → ✅ (when endpoint is implemented)
   - ✅ → 🔄 (when docs match code exactly)
5. Preserve manual notes/comments

### Step 3: Update DB_DESIGN.md

1. Read actual database schema (Drizzle, Prisma, TypeORM, etc.)
2. Compare with `docs/DB_DESIGN.md`
3. Update:
   - Table definitions
   - Column types
   - Relationships
   - Indexes

### Step 4: Update UI_SPEC.md (if requested)

Only if `$ARGUMENTS` contains "ui" or "all":
1. Scan UI components
2. Update screen list
3. Update component specs

---

## Usage

```bash
# Sync API and DB docs (default after BE)
/ipa-docs:sync

# Sync all including UI
/ipa-docs:sync all

# Sync specific doc
/ipa-docs:sync api
/ipa-docs:sync db
/ipa-docs:sync ui
```

---

## Output

Report changes made:
```
## Docs Sync Report

### API_SPEC.md
- Added: POST /api/users/register
- Updated: GET /api/users/:id response schema
- Removed: (none)
- **Status Updates:**
  - POST /auth/login: ⏳ → ✅
  - POST /auth/register: ⏳ → ✅
  - GET /users/:id: ⏳ → 🔄 (synced)

### DB_DESIGN.md
- Added: sessions table
- Updated: users table (added email_verified column)
- Removed: (none)

### UI_SPEC.md
- (not synced - use /ipa-docs:sync ui)
```

---

## Important

- **Preserve manual notes**: Don't overwrite human-added comments
- **Backup before sync**: Create backup if significant changes
- **Review changes**: Show diff before applying

**IMPORTANT:** This command analyzes codebase and updates docs. Do not implement code.
