---
name: ipa:init
description: Initialize IPA docs from existing codebase (reverse engineering)
user-invocable: true
argument-hint: "[path1] [path2] ... or monorepo path"
---

## Purpose

Generate IPA-standard documentation from an **existing codebase** that has no docs.

This is the entry point for applying IPA workflow to running projects.

Output:
- `docs/SRD.md` - Inferred from business logic
- `docs/UI_SPEC.md` - Extracted from UI components
- `docs/API_SPEC.md` - Extracted from API routes
- `docs/DB_DESIGN.md` - Extracted from database schema

---

## Input

<paths>
$ARGUMENTS
</paths>

### Supported Structures

**1. Monorepo (single path or current dir):**
```bash
/ipa:init
/ipa:init ./my-project
```

**2. Separate FE/BE repos:**
```bash
/ipa:init ./frontend ./backend
```

**3. Microservices (multiple repos):**
```bash
/ipa:init ./user-service ./order-service ./payment-service
```

---

## When to Use

| Situation | Use This? |
|-----------|-----------|
| Existing project, no docs | ✅ Yes |
| Existing project, has some docs | ✅ Yes (will merge/enhance) |
| Separate FE/BE repos | ✅ Yes (pass both paths) |
| Microservices | ✅ Yes (pass all service paths) |
| New project from scratch | ❌ No (use /ipa:all) |
| After implementing tasks | ❌ No (use /ipa-docs:sync) |

---

## Workflow

### Step 1: Detect Tech Stack

Scan for:
```
package.json → Node.js ecosystem
requirements.txt / pyproject.toml → Python
go.mod → Go
Cargo.toml → Rust
```

Auto-detect:
- Framework (Next.js, NestJS, FastAPI, etc.)
- ORM (Drizzle, Prisma, SQLAlchemy, etc.)
- UI library (React, Vue, Svelte, etc.)

Save to: `docs/tech-stack.md` (if not exists)

### Step 2: Extract API Routes → API_SPEC.md

Scan for route definitions:

**Node.js/Express:**
```javascript
app.get('/api/users', ...)
router.post('/auth/login', ...)
```

**NestJS:**
```typescript
@Controller('users')
@Get(':id')
@Post()
```

**FastAPI:**
```python
@app.get("/users/{id}")
@app.post("/auth/login")
```

### Step 3: Extract DB Schema → DB_DESIGN.md

Scan for schema definitions:

**Drizzle:**
```typescript
export const users = pgTable('users', { ... })
```

**Prisma:**
```prisma
model User { ... }
```

### Step 4: Extract UI Screens → UI_SPEC.md

Scan for:

**Next.js/React:**
```
app/page.tsx → Home
app/dashboard/page.tsx → Dashboard
components/*.tsx → Components
```

### Step 5: Infer SRD.md

From collected data, infer:

**Entities (E-xx):** From DB tables
**Features (FR-xx):** From API endpoints grouped by resource
**Screens (S-xx):** From UI pages

### Step 6: Auto-Validate

Execute `/ipa:validate` logic automatically.

---

## After Generation

```
/ipa:init complete
        ↓
   Auto-validation ran
        ↓
   Review generated docs & validation report
        ↓
   Enhance manually:
   - Add business context to SRD
   - Add CJX to UI_SPEC
   - Fix any validation warnings
        ↓
   Ready for:
   - /lean [new feature] to extend
   - /plan to create tasks
```

---

## Usage

```bash
# Initialize IPA docs from existing codebase
/ipa:init

# Force regenerate (overwrite existing)
/ipa:init --force
```

---

## Important Notes

1. **Review generated docs** - Auto-inference is not perfect
2. **Add business context** - Code doesn't capture "why"
3. **Enhance CJX manually** - User journeys need human input
4. **SRD business rules** - Need domain knowledge

**IMPORTANT:** This command analyzes codebase and generates documentation. Do not implement code.
