---
description: Initialize IPA docs from existing codebase (reverse engineering)
argument-hint: [path1] [path2] ... or monorepo path
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

**4. Mixed paths:**
```bash
/ipa:init ~/projects/my-fe ~/projects/my-be ~/projects/shared-lib
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
| After implementing tasks | ❌ No (use /docs:sync) |

---

## Workflow

### Step 0: Parse Input Paths

If multiple paths provided:
```
/ipa:init ./frontend ./backend
        ↓
┌─────────────────────────────────────────┐
│ Paths detected:                         │
│ - ./frontend → FE (React/Vue/etc.)      │
│ - ./backend → BE (NestJS/FastAPI/etc.)  │
└─────────────────────────────────────────┘
```

For microservices:
```
/ipa:init ./user-svc ./order-svc ./payment-svc
        ↓
┌─────────────────────────────────────────┐
│ Services detected:                      │
│ - user-svc → User Service               │
│ - order-svc → Order Service             │
│ - payment-svc → Payment Service         │
│                                         │
│ API_SPEC will group by service          │
│ DB_DESIGN will show per-service schemas │
└─────────────────────────────────────────┘
```

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

**Next.js App Router:**
```
app/api/users/route.ts → GET, POST
app/api/users/[id]/route.ts → GET, PUT, DELETE
```

Extract:
- Method, Endpoint, Handler name
- Request/Response types (if TypeScript/Pydantic)
- Auth decorators/middleware
- Set Status = 🔄 (synced from code)

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

**SQLAlchemy:**
```python
class User(Base): ...
```

**Raw SQL migrations:**
```sql
CREATE TABLE users ( ... )
```

Extract:
- Tables, Columns, Types
- Relationships (FK)
- Indexes
- Generate ERD (Mermaid)

### Step 4: Extract UI Screens → UI_SPEC.md

Scan for:

**Next.js/React:**
```
app/page.tsx → Home
app/dashboard/page.tsx → Dashboard
app/login/page.tsx → Login
components/*.tsx → Components
```

**Vue:**
```
pages/*.vue
views/*.vue
```

Extract:
- Screen list with routes
- Component inventory
- Basic layout inference

Note: UI_SPEC will be basic - recommend manual enhancement for CJX.

### Step 5: Infer SRD.md

From collected data, infer:

**Entities (E-xx):**
- From DB tables
- Example: users table → E-01: User

**Features (FR-xx):**
- From API endpoints grouped by resource
- Example: /auth/* → FR-01: Authentication

**Screens (S-xx):**
- From UI pages
- Example: /login → S-01: Login Screen

**Business Rules (BR-xx):**
- From validation logic, middleware
- Minimal - recommend manual addition

---

## Output Format

### Multi-Repo: docs/tech-stack.md

```markdown
# Tech Stack

## Project Structure

| Component | Path | Type |
|-----------|------|------|
| Frontend | ./frontend | React + TypeScript |
| Backend | ./backend | NestJS + PostgreSQL |

## Frontend (./frontend)
| Component | Technology |
|-----------|------------|
| Framework | React 18 |
| Language | TypeScript |
| UI | Tailwind CSS |

## Backend (./backend)
| Component | Technology |
|-----------|------------|
| Framework | NestJS |
| Language | TypeScript |
| Database | PostgreSQL |
| ORM | Prisma |
```

### Microservices: docs/tech-stack.md

```markdown
# Tech Stack

## Architecture
Type: Microservices

## Services

| Service | Path | Stack | Database |
|---------|------|-------|----------|
| User Service | ./user-svc | NestJS | PostgreSQL |
| Order Service | ./order-svc | FastAPI | MongoDB |
| Payment Service | ./payment-svc | Go | Redis |

## Service Details
[Details per service...]
```

### docs/SRD.md (Inferred)

```markdown
# System Requirement Definition (Inferred from Code)

> ⚠️ This SRD was auto-generated from existing codebase.
> Review and enhance with business context.

## 1. Overview
[Inferred from README.md or package.json description]

## 2. Entities
| ID | Entity | Source | Description |
|----|--------|--------|-------------|
| E-01 | User | users table | [inferred] |
| E-02 | Order | orders table | [inferred] |

## 3. Features
| ID | Feature | Source | Description |
|----|---------|--------|-------------|
| FR-01 | Authentication | /auth/* APIs | [inferred] |
| FR-02 | User Management | /users/* APIs | [inferred] |

## 4. Screens
| ID | Screen | Route | Source |
|----|--------|-------|--------|
| S-01 | Login | /login | app/login/page.tsx |
| S-02 | Dashboard | /dashboard | app/dashboard/page.tsx |

## 5. IPA Checklist
- [x] Entities extracted from DB
- [x] Features inferred from APIs
- [x] Screens extracted from UI
- [ ] Business rules (needs manual input)
- [ ] Non-functional requirements (needs manual input)
```

### docs/API_SPEC.md

Same format as /ipa:dd output, but:
- Status = 🔄 (already synced)
- Extracted from actual code

**For Microservices - Group by Service:**

```markdown
## 3. Endpoint Matrix

### User Service (./user-svc)
| Method | Endpoint | Description | Auth | Status |
|--------|----------|-------------|------|--------|
| POST | /users | Create user | No | 🔄 |
| GET | /users/:id | Get user | Yes | 🔄 |

### Order Service (./order-svc)
| Method | Endpoint | Description | Auth | Status |
|--------|----------|-------------|------|--------|
| POST | /orders | Create order | Yes | 🔄 |
| GET | /orders/:id | Get order | Yes | 🔄 |

### Payment Service (./payment-svc)
| Method | Endpoint | Description | Auth | Status |
|--------|----------|-------------|------|--------|
| POST | /payments | Process payment | Yes | 🔄 |
```

### docs/DB_DESIGN.md

Same format as /ipa:dd output, but:
- Extracted from actual schema

**For Microservices - Separate ERD per Service:**

```markdown
## 2. Entity-Relationship Diagram

### User Service Database
\`\`\`mermaid
erDiagram
    users ||--o{ user_roles : "has"
\`\`\`

### Order Service Database
\`\`\`mermaid
erDiagram
    orders ||--|{ order_items : "contains"
\`\`\`

### Payment Service Database
\`\`\`mermaid
erDiagram
    payments ||--o{ transactions : "has"
\`\`\`
```

### docs/UI_SPEC.md

Basic version:
- Screen list with routes
- Component inventory
- Placeholder for CJX (recommend manual addition)

---

### Step 6: Auto-Validate

Execute `/ipa:validate` logic automatically:
- Check ID consistency (FR-xx, S-xx, E-xx)
- Validate traceability chain
- Check cross-references
- Report any errors/warnings

```
✓ Validation Summary:
  - Features (FR): 5 (inferred) ✓
  - Screens (S): 4 (extracted) ✓
  - Entities (E): 3 (from DB) ✓
  - Errors: 0
  - Warnings: 3 (orphan IDs - needs manual review)
  - Status: PASS
```

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
   - Add missing business rules
   - Fix any validation warnings
        ↓
   /ipa:validate (optional - after manual edits)
        ↓
   Ready for:
   - Brainstorm new features
   - /ipa:srd [new feature] to extend SRD
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

## Comparison

| Command | Direction | Use Case |
|---------|-----------|----------|
| `/ipa:all` | Spec → Code | New project |
| `/ipa:init` | Code → Spec | Existing project |
| `/docs:sync` | Code → Update Spec | After task done |

---

## Important Notes

1. **Review generated docs** - Auto-inference is not perfect
2. **Add business context** - Code doesn't capture "why"
3. **Enhance CJX manually** - User journeys need human input
4. **SRD business rules** - Need domain knowledge

**IMPORTANT:** This command analyzes codebase and generates documentation. Do not implement code.
