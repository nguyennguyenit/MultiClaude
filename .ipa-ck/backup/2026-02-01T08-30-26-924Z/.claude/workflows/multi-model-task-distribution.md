# Task Distribution Protocol

Task breakdown following **IPA workflow** and **YAGNI/KISS/DRY** principles.

**CRITICAL: Phase-First Structure** - ALL project types use nested phase folders.

---

## Phase-First Structure (MANDATORY)

**ALL project types** must use this unified structure:

```
plans/{date}-{slug}/
├── plan.md                      # Overview: goals, phases, dependencies
├── phase-01-{name}/
│   ├── core.md                  # Business logic, processing (replaces BE.md)
│   ├── ui.md                    # User interface, presentation (replaces FE.md)
│   ├── data.md                  # Data storage, pipelines, transformations
│   ├── infra.md                 # Infrastructure, deployment, cloud config
│   ├── svc-{service}.md         # Microservices (per service)
│   └── tasks.md                 # Generic fallback (simple/mixed projects)
├── phase-02-{name}/
│   └── ...
└── phase-NN-{name}/
```

**Layer Naming Pattern:** `{layer}-{context}.md` (e.g., `core-cloud.md`, `ui-mobile.md`)

**Base Layers (6 total):**

| Layer | Purpose | Default File |
|-------|---------|--------------|
| `core` | Business logic, processing, algorithms | `core.md` |
| `ui` | User interface, presentation | `ui.md` |
| `data` | Data storage, pipelines, transformations | `data.md` |
| `infra` | Infrastructure, deployment, cloud config | `infra.md` |
| `svc` | Service-specific (microservices) | `svc-{name}.md` |
| `tasks` | Generic fallback (simple/mixed projects) | `tasks.md` |

**Context Suffixes (AI decides when needed):**

| Layer | Common Contexts | Examples |
|-------|-----------------|----------|
| `core` | backend, cloud, worker, ml, rag, bot, gateway | `core-cloud.md`, `core-ml.md` |
| `ui` | web, mobile, ios, android, desktop | `ui-mobile.md`, `ui-ios.md` |
| `data` | db, pipeline, storage, cache | `data-pipeline.md`, `data-cache.md` |
| `infra` | k8s, terraform, ci, docker | `infra-k8s.md`, `infra-ci.md` |

**AI Decision Rules:**
1. **Default:** Use base layer only (`core.md`, `ui.md`)
2. **Add context when:** Multiple implementations of same layer exist in project
3. **Consistency:** Once context added, use throughout entire project

**Execution Rule:** Strict Sequential - Phase N+1 waits for Phase N to complete.

---

## Project Type Detection

| Project Type | Structure | Layer Files (per phase) | Within-Phase Order |
|--------------|-----------|-------------------------|-------------------|
| **Web App (Monorepo)** | Single codebase (Next.js) | `tasks.md` | Sequential |
| **Web App (FE/BE)** | `apps/FE/` + `apps/BE/` | `core.md` + `ui.md` | data → core → ui |
| **Microservices** | Multiple services | `svc-{name}.md` | Parallel → core-gateway |
| **CLI Tool** | Single codebase | `tasks.md` | Sequential |
| **Desktop App** | UI + Core logic | `core.md` + `ui.md` | data → core → ui |
| **MCP Server** | Tools/Resources | `tasks.md` | Sequential |
| **Chatbot/RAG** | Bot + RAG pipeline | `data.md` + `core.md` + `ui.md` | data → core → ui |
| **ML/Data** | Data pipelines, models | `data.md` + `core-ml.md` | data → core |
| **Library/SDK** | Core + Tests + Docs | `tasks.md` | Sequential |

### Auto-Detection Logic

```
┌─────────────────────────────────────────────────────────────┐
│ PROJECT TYPE AUTO-DETECTION                                 │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│ apps/FE/ + apps/BE/ exists?                                │
│   YES → FE/BE project → phase-XX/core.md + ui.md           │
│   NO ↓                                                      │
│                                                             │
│ svc-* or service-* dirs exist?                             │
│   YES → Microservices → phase-XX/svc-{name}.md             │
│   NO ↓                                                      │
│                                                             │
│ Desktop patterns (Electron, Tauri, SwiftUI)?               │
│   YES → Desktop → phase-XX/core.md + ui.md                 │
│   NO ↓                                                      │
│                                                             │
│ ML/Data patterns (notebooks, pipelines, models)?           │
│   YES → ML/Data → phase-XX/data.md + core-ml.md            │
│   NO ↓                                                      │
│                                                             │
│ Chatbot/RAG patterns?                                       │
│   YES → Chatbot → phase-XX/data.md + core.md + ui.md       │
│   NO → Monorepo → phase-XX/tasks.md (default)              │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## PRE-EXECUTION VALIDATION CHECKPOINT

**CRITICAL:** Before creating ANY plan files, validate these requirements:

### Validation Checklist

**Light Mode Exception:**
- If `docs/` missing: SKIP doc existence checks.
- MUST STILL validate:
  - [ ] Phase-first structure (`phase-XX/`)
  - [ ] Layer naming (`core.md`, `ui.md`)

**Project Type Detection:**
- [ ] Analyzed codebase structure (apps/FE + apps/BE exists?)
- [ ] Identified project type (Web App FE/BE, Desktop, Microservices, etc.)
- [ ] Selected correct layer files (core.md, ui.md, data.md, infra.md, svc-*.md, tasks.md)

**Phase-First Structure:**
- [ ] Using `phase-XX-{name}/` folders (NOT flat phase-XX-*.md files)
- [ ] Using layer files inside phase folders (core.md, ui.md, NOT BE.md, FE.md)
- [ ] plan.md created with phases overview

**Naming Convention:**
- [ ] NO usage of deprecated names: BE.md, FE.md, backend.md, frontend.md
- [ ] YES usage of current names: core.md, ui.md, data.md, infra.md, svc-{name}.md, tasks.md

**UI Design Specs (if UI layer exists):**
- [ ] docs/UI_DESIGN_SPEC.md exists (from /ipa:mockup-analyze)
- [ ] UI tasks reference UI_DESIGN_SPEC.md with specific design tokens
- [ ] NO vague "match mockup" tasks without specifics

### Enforcement

If ANY validation check fails → STOP and fix before proceeding.

**Example Failure:**
```
❌ INVALID: plans/260101-feature/phase-01-be-apis.md
✅ VALID:   plans/260101-feature/phase-01-apis/core.md
```

**Example Success:**
```
✅ Phase-first structure used
✅ Layer files inside phase folders
✅ UI_DESIGN_SPEC.md referenced in ui.md tasks
✅ All checks passed → proceed with plan creation
```

---

## 0. Prerequisites - IPA Docs as Single Source of Truth

### New Project
```
/ipa:all [requirements]
    ↓
docs/SRD.md, UI_SPEC.md, API_SPEC.md, DB_DESIGN.md
    ↓
/plan → Creates task files
```

### Existing Project
```
/ipa:init [paths...]
    ↓
docs/ generated from code
    ↓
Review & enhance docs
    ↓
/plan → Creates task files
```

### Required Docs

| Doc | Purpose | Created By |
|-----|---------|------------|
| `docs/SRD.md` | Requirements, entities | /ipa:srd or /ipa:init |
| `docs/API_SPEC.md` | API contracts | /ipa:dd or /ipa:init |
| `docs/UI_SPEC.md` | UI/UX specifications | /ipa:bd or /ipa:init |
| `docs/DB_DESIGN.md` | Database schema | /ipa:dd or /ipa:init |

### Design Context (@path references)

When planning UI with `@path` design references:

```bash
/plan:hard implement dashboard @prototypes/html-mockups/dashboard
```

**Flow:**
1. `ipa-context-aware-planning` skill activates
2. Parses HTML/CSS/JS from @path
3. Generates `{plan-dir}/reports/design-analysis-report.md`
4. Copies design files to `{plan-dir}/design/`
5. UI tasks in `ui.md` reference design report for 100% match

**Output:**
```
{plan-dir}/
├── design/                           # Copied mockup files
│   └── dashboard.html, dashboard.css
├── reports/
│   └── design-analysis-report.md     # Component inventory, colors, etc.
├── plan.md
└── phase-XX/
    └── ui.md                         # Tasks reference design report
```

**Rule:** Docs are drafts initially. Update via `/ipa-docs:sync` after implementation.

---

## 1. Task Sizing (S/M/L)

| Size | Scope | Model | Pre-Implementation |
|------|-------|-------|-------------------|
| **S** | 1-2 files, simple logic | Any | Direct implement |
| **M** | 2-4 files, single feature | Assigned (BE/FE) | Direct implement |
| **L** | 4+ files, unclear approach | Senior (Opus) | AskUserQuestion first |

### L-Task Handling

```
L task identified
       ↓
Use AskUserQuestion to clarify approach
       ↓
Split into S/M subtasks
       ↓
Add subtasks to TodoWrite
       ↓
Implement sequentially
```

**No separate discuss_*.md files** - use AskUserQuestion tool instead.

---

## 2. TDD Protocol (Mandatory for [TDD] Tasks)

If a task has the `[TDD]` flag (e.g., `Task 1: Tax Calc [M] [TDD]`), you **MUST** follow this Red-Green-Refactor cycle:

```
Step 1: Write Test (RED)
   ↓
Create *.test.ts file FIRST
   ↓
Run test → MUST FAIL (confirm logic is tested)
   ↓
Step 2: Implement (GREEN)
   ↓
Write minimal code to pass test
   ↓
Run test → MUST PASS
   ↓
Step 3: Refactor (Clean Code)
   ↓
Optimize code while keeping tests GREEN
```

**Enforcement:**
- **NEVER** write implementation code before test for [TDD] tasks.
- **ALWAYS** show test failure output before implementing.
- **ALWAYS** show test success output before marking task complete.

---

## 3. Phase Structure (Unified for ALL Project Types)

### plan.md Template

```markdown
---
title: "{Brief title}"
description: "{One sentence}"
status: pending
priority: P2
effort: {sum of phases}
branch: {git branch}
tags: [relevant, tags]
created: {YYYY-MM-DD}
---

# Plan: {Feature Name}

**Created:** {date}
**Project Type:** {auto-detected}
**Execution:** Strict Sequential (Phase N+1 waits for Phase N)

## Phases Overview

| Phase | Name | Files | Status |
|-------|------|-------|--------|
| 01 | {name} | core.md, ui.md | pending |
| 02 | {name} | tasks.md | pending |

## Phase Dependencies

Phase 01 ──complete──> Phase 02 ──complete──> Phase 03

## Refs
- docs/API_SPEC.md
- docs/UI_SPEC.md
- docs/DB_DESIGN.md
```

### Layer File Template (core.md/ui.md/data.md/infra.md/svc-*.md/tasks.md)

```markdown
# Phase {NN}: {Phase Name} - {Layer}

**Model:** Opus / Sonnet / Gemini-Pro-3
**Ownership:** `apps/BE/**` only (or appropriate path)
**Status:** pending | in_progress | completed
**Depends on:** Phase {NN-1} must be completed

## Refs (Single Source of Truth - NO duplication)
- 📋 API: docs/API_SPEC.md#section
- 📋 UI: docs/UI_SPEC.md#screen
- 📋 DB: docs/DB_DESIGN.md#table

---

### Task 1: {Task Name} [S/M/L]

**Files:** (exclusive ownership)
- `apps/BE/src/path/file.ts`

**Dependencies:**
- ⏳ WAIT: Task X (must complete first)
- 🔗 SYNC: Task Y (needs alignment)

**Acceptance:**
- [ ] Matches contract in docs/
- [ ] Tests pass

---

## Integration Checklist
- [ ] All tasks done
- [ ] Matches docs/ contract
- [ ] Tests pass
- [ ] Human review completed
- [ ] /ipa-docs:sync approved by user
```

### Examples by Project Type

**Web App FE/BE (phase-01-auth/):**
```
phase-01-auth/
├── core.md          # Backend: API routes, business logic
└── ui.md            # Frontend: Components, pages
```

**Complex Full-Stack (phase-01-setup/):**
```
phase-01-setup/
├── data.md          # Database schema
├── core.md          # Main backend
├── core-cloud.md    # Cloud functions
├── ui.md            # Web frontend
├── ui-mobile.md     # Mobile app
└── infra.md         # Deployment
```

**ML/Data Project (phase-01-pipeline/):**
```
phase-01-pipeline/
├── data.md          # Data ingestion
├── data-pipeline.md # ETL pipeline
├── core-ml.md       # Model training
└── ui.md            # Dashboard
```

**Microservices (phase-01-order-processing/):**
```
phase-01-order-processing/
├── svc-user.md
├── svc-order.md
├── svc-payment.md
└── core-gateway.md
```

**Desktop App (phase-01-core-setup/):**
```
phase-01-core-setup/
├── core.md          # Core logic, data layer
└── ui.md            # UI components
```

**Monorepo/CLI/MCP (phase-01-setup/):**
```
phase-01-setup/
└── tasks.md         # All tasks in single file
```

---

## 3. Model Assignment

### Recommended Models by Task Type

| Task Type | Recommended Model | Reason |
|-----------|-------------------|--------|
| **core** API/Logic | Opus, Sonnet, GLM | Strong reasoning |
| **core** Database | Opus, GLM | Complex queries |
| **data** Pipelines | Opus, Sonnet | Data processing |
| **ui** Components | Gemini-Pro-3 | Visual understanding |
| **ui** Styling | Gemini-Pro-3 | CSS/UI expertise |
| **infra** DevOps | Opus, Sonnet | Infrastructure |
| **Full-stack** | Opus, Sonnet | Both core+ui in one |
| **Microservice** | Any (per service) | Depends on complexity |

### File Headers by Project Type

**Monorepo (tasks.md):**
```markdown
# Phase XX: [Name]

**Model:** Opus / Sonnet
**Ownership:** Full codebase
**Refs:** docs/API_SPEC.md, docs/UI_SPEC.md
```

**Core Layer (core.md):**
```markdown
# Phase XX: [Name] - Core

**Model:** Opus / Sonnet / GLM
**Ownership:** `apps/BE/**` or `src/core/**`
```

**UI Layer (ui.md):**
```markdown
# Phase XX: [Name] - UI

**Model:** Gemini-Pro-3
**Ownership:** `apps/FE/**` or `src/ui/**`
```

**UI Layer with Design Context (ui.md - when @path provided):**

When plan created with `@path` design reference, ui.md MUST use this enhanced template:

```markdown
# Phase XX: [Name] - UI

**Model:** Gemini-Pro-3
**Ownership:** `apps/FE/**` or `src/ui/**`
**Tech Stack:** {Framework} (from .claude/tech-stack.md)

## Refs (Design Traceability)
- 📋 Design Report: {plan-dir}/reports/design-analysis-report.md
- 📋 Mockup Files: {plan-dir}/design/
- 📋 UI Spec: docs/UI_SPEC.md#screen

---

### Task 1: {Component Name} [S/M/L]

**Design Ref:** design-analysis-report.md#component-name

**Files:**
- `apps/FE/src/components/{ComponentName}.tsx`

**Implementation:** (EXACT from design report)
```tsx
// Copy FULL code from design-analysis-report.md
// Transform class → className (if React/Next.js)
// Transform icons to import statements
```

**Colors:** (from design report)
- Primary: #XXXXXX
- Background: #XXXXXX

**Typography:** (from design report)
- Font: Inter
- Sizes: text-2xl, text-base

**Acceptance (100% Design Match):**
- [ ] Every element from design present
- [ ] All text exact (titles, labels, placeholders)
- [ ] All colors match design report
- [ ] All SVG paths complete
- [ ] All hover/focus states implemented
- [ ] Matches tech stack adaptation rules
```

**Data Layer (data.md):**
```markdown
# Phase XX: [Name] - Data

**Model:** Opus / Sonnet
**Ownership:** `src/data/**` or `db/**`
```

**Infra Layer (infra.md):**
```markdown
# Phase XX: [Name] - Infrastructure

**Model:** Opus / Sonnet
**Ownership:** `infra/**` or `deploy/**`
```

**Microservices (svc-{name}.md):**
```markdown
# Phase XX: [Name] - [Service Name]

**Model:** Opus / Sonnet
**Ownership:** `./service-name/**` only
**Refs:** docs/API_SPEC.md#service-name
```

---

## 4. Task Template

```markdown
### Task [N]: [Task Name] [S/M/L]

**Refs:** (Single source of truth - NO duplication)
- 📋 API: docs/API_SPEC.md#section
- 📋 UI: docs/UI_SPEC.md#screen
- 📋 DB: docs/DB_DESIGN.md#table
- 📋 Design: docs/UI_DESIGN_SPEC.md#screen-name
- 📋 Mock: docs/prototypes/s{N}-{screen}.html
- 📋 Styles: docs/prototypes/styles.css
- 📋 Assets: docs/prototypes/icons/

**Files:** (exclusive ownership)
- `apps/BE/src/path/file.ts`

**Dependencies:**
- ⏳ WAIT: Task X (must complete first)
- 🔗 SYNC: Task Y (needs alignment)

**Acceptance:**
- [ ] Matches contract in docs/API_SPEC.md
- [ ] Tests pass
```

### Dependency Markers

| Marker | Meaning |
|--------|---------|
| `📋 REF: docs/...` | Reference this doc (single source of truth) |
| `⏳ WAIT: Task X` | Cannot start until Task X done |
| `🔗 SYNC: Task Y` | Needs alignment with parallel task |

**No custom status symbols** - use TodoWrite for tracking.

### UI Implementation Requirements

For ANY task implementing UI components:

**MUST include:**
1. Reference to UI_DESIGN_SPEC.md with specific section
2. Exact colors (hex values, Tailwind classes)
3. Exact fonts (family, size, weight, Tailwind classes)
4. Exact spacing (px values, Tailwind classes)
5. Component mapping (HTML → shadcn/ui or custom)
6. Responsive behavior per breakpoint

**Example (Good):**
```markdown
### Task 3.2: Dashboard Stats Component [M]

**Refs:**
- 📋 Design: docs/UI_DESIGN_SPEC.md#02-dashboard
- 📋 API: docs/API_SPEC.md#stats-dashboard

**Implementation:**
- Container: `grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6`
- Card: shadcn/ui Card component with `bg-white rounded-xl shadow-md p-6`
- Colors: primary (#2563EB), dark (#0F172A)
- Typography: Heading `text-2xl font-bold`, Value `text-4xl font-heading`
- Responsive: 1-col mobile, 2-col tablet, 4-col desktop

**Acceptance:**
- [ ] Visual match: Screenshot diff < 2% variance
- [ ] Colors exact: primary #2563EB, not #2563EC or similar
```

**Example (Bad - DO NOT USE):**
```markdown
### Task 3.2: Dashboard Stats Component [M]

**Implementation:**
- Match the mockup design   ❌ TOO VAGUE

**Acceptance:**
- [ ] Looks good   ❌ NOT MEASURABLE
```

---

## 5. Execution Flow (Strict Sequential)

**CRITICAL:** Phase N+1 can ONLY start after Phase N is fully completed.

### Unified Execution Flow (ALL Project Types)

```
1. /plan → Detect project type
        → Create plan.md
        → Create phase-XX-{name}/ folders with layer files

2. Execute Phase 01:
   ├── /code phase-01/data.md (if exists)
   │   └── Implement data layer first
   ├── /code phase-01/core.md (or svc-*.md, tasks.md)
   │   └── Implement core/logic layer
   ├── User verifies implementation ✓
   ├── AskUserQuestion: "Ready to sync docs?"
   │   └── YES → /ipa-docs:sync
   │   └── NO → Continue without sync
   ├── /code phase-01/ui.md (if exists)
   │   └── Implement UI layer
   ├── User verifies implementation ✓
   ├── AskUserQuestion: "Ready to sync docs?"
   │   └── YES → /ipa-docs:sync
   │   └── NO → Continue without sync
   ├── /code phase-01/infra.md (if exists, run last)
   │   └── Implement infrastructure
   └── Mark Phase 01 completed in plan.md

3. Execute Phase 02 (ONLY after Phase 01 completed)
   └── Same flow as above

4. Repeat until all phases done
```

### Within-Phase Order

**Execution Order:** `data` → `core` → `ui` → `infra`

| Layer | Priority | Rationale |
|-------|----------|-----------|
| `data` | 1st | Data foundation first |
| `core` | 2nd | Business logic depends on data |
| `ui` | 3rd | UI consumes core/data |
| `infra` | Last | Deployment - can run separately |
| `svc-*` | Parallel | Services can run in parallel |

| Project Type | Execution Order |
|--------------|-----------------|
| Web App FE/BE | data → core → ui |
| Desktop/Mobile | data → core → ui |
| Chatbot/RAG | data → core → ui |
| ML/Data | data → core-ml |
| Microservices | svc-*.md (parallel) → core-gateway |
| Monorepo | tasks.md |

### docs:sync Rules (HUMAN REVIEW REQUIRED)

**NEVER auto-sync docs.** Always ask user permission:

```
After layer implementation complete:
       ↓
User verifies implementation
       ↓
AskUserQuestion: "Implementation verified. Ready to sync docs?"
       ↓
YES → Execute /ipa-docs:sync
NO → Continue to next layer/phase
```

| Trigger | Docs Updated |
|---------|--------------|
| After data.md/core.md/svc-*.md | API_SPEC.md, DB_DESIGN.md |
| After ui.md | UI_SPEC.md (if changed) |
| After infra.md | Deployment docs |
| After tasks.md | All affected docs |

---

## 6. Integration Checklist

**Add at end of core.md, ui.md, data.md, infra.md:**

```markdown
---

## Integration Checklist

### Before Marking Phase Complete
- [ ] All tasks done (tracked in TodoWrite)
- [ ] Matches docs/API_SPEC.md contract
- [ ] Tests pass
- [ ] No files modified outside ownership

### Docs Sync Required
- [ ] Run `/ipa-docs:sync` after implementation
- [ ] Verify docs/API_SPEC.md reflects actual API
- [ ] Verify docs/DB_DESIGN.md reflects actual schema
```

---

## 7. File Ownership Rules

| File Pattern | Owner | Rule |
|--------------|-------|------|
| `apps/BE/**`, `src/core/**` | core.md | ui.md must NEVER modify |
| `apps/FE/**`, `src/ui/**` | ui.md | core.md must NEVER modify |
| `src/data/**`, `db/**` | data.md | Others must NEVER modify |
| `infra/**`, `deploy/**` | infra.md | Others must NEVER modify |
| `docs/**` | `/ipa-docs:sync` | Tasks only reference, never modify directly |
| `ui-mockup/**` | Reference only | Neither modifies |

---

## 8. Quick Reference

### Phase-First Structure (ALL Project Types)

```
plans/{date}-{slug}/
├── plan.md
├── phase-01-{name}/
│   └── {layer}.md (core.md, ui.md, data.md, infra.md, svc-*.md, tasks.md)
├── phase-02-{name}/
│   └── ...
└── phase-NN-{name}/
```

### Base Layers

| Layer | Purpose | Default File |
|-------|---------|--------------|
| `core` | Business logic, processing | `core.md` |
| `ui` | User interface | `ui.md` |
| `data` | Data storage, pipelines | `data.md` |
| `infra` | Infrastructure, deployment | `infra.md` |
| `svc` | Microservices | `svc-{name}.md` |
| `tasks` | Generic fallback | `tasks.md` |

### Context Suffix Pattern

Format: `{layer}-{context}.md`

Examples: `core-cloud.md`, `core-ml.md`, `ui-mobile.md`, `data-pipeline.md`, `infra-k8s.md`

### Execution Rules

| Rule | Description |
|------|-------------|
| **Strict Sequential** | Phase N+1 waits for Phase N |
| **Within-Phase Order** | data → core → ui → infra |
| **docs:sync** | HUMAN REVIEW REQUIRED - never auto-sync |

### Layer Files by Project Type

| Project Type | Layer Files | Order |
|--------------|-------------|-------|
| Web App FE/BE | core.md → ui.md | data → core → ui |
| Desktop/Mobile | core.md → ui.md | data → core → ui |
| Chatbot/RAG | data.md → core.md → ui.md | data → core → ui |
| ML/Data | data.md → core-ml.md | data → core |
| Microservices | svc-*.md → core-gateway.md | parallel → gateway |
| Monorepo/CLI/MCP | tasks.md | sequential |

### Task Size Quick Check

- **S**: 1-2 files, no questions needed
- **M**: 2-4 files, context from docs sufficient
- **L**: 4+ files OR approach unclear → AskUserQuestion first

---

## 9. YAGNI/KISS/DRY Compliance

| Principle | How This Protocol Complies |
|-----------|---------------------------|
| **YAGNI** | Only create layer files when actually needed |
| **KISS** | 6 base layers cover all use cases, context suffix for special cases |
| **DRY** | Refs to docs/ instead of duplicating contracts |

### What Was Removed

| Removed | Reason | Alternative |
|---------|--------|-------------|
| `BE.md`, `FE.md` | Replaced with generic naming | `core.md`, `ui.md` |
| `rag.md`, `bot.md` | Replaced with layer + context | `data.md`, `core.md`, `ui.md` |
| `gateway.md` | Replaced with context suffix | `core-gateway.md` |
| OVERVIEW.md | DRY - duplicates docs/API_SPEC.md | `📋 REF: docs/API_SPEC.md` |
| INTEGRATION.md | KISS - unnecessary file | Checklist at end of task files |
| discuss_*.md | DRY - duplicates AskUserQuestion | Use AskUserQuestion tool |
| Status symbols | DRY - duplicates TodoWrite | Use TodoWrite tracking |

---

**Last Updated:** 2026-01-02
**Version:** 6.0
**Changes:**
- **Layer Naming Convention** - Unified naming: core, ui, data, infra, svc, tasks
- **Context Suffix Pattern** - `{layer}-{context}.md` for special cases
- **Execution Order** - data → core → ui → infra
- **Replaced BE.md/FE.md** - Now use core.md/ui.md
- **Added data.md, infra.md** - New base layers for data and infrastructure
