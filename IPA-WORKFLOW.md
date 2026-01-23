# IPA Workflow Guide

Claude Code template with IPA (Information-technology Promotion Agency, Japan) documentation workflow.

---

## ⚠️ Command Prefix Note

**If ClaudeKit installed with `--prefix`:** All CK commands use `/ck:` namespace.

| Standard | With Prefix |
|----------|-------------|
| `/plan` | `/ck:plan` |
| `/plan:fast` | `/ck:plan:fast` |
| `/plan:hard` | `/ck:plan:hard` |
| `/code` | `/ck:code` |

**IPA commands unchanged:** `/ipa:*`, `/lean:*`, `/ipa-docs:sync` always work without prefix.

**Detection:** Check `.claude/commands/` - if files have `ck:` prefix, use prefixed commands.

---

## 📁 Custom Paths Support

If you use custom paths in `.ck.json`:

```json
{
  "paths": {
    "ck-docs": "ck-docs",
    "ck-plans": "ck-plans"
  }
}
```

IPA commands will respect your custom paths. Replace `docs/` and `plans/` references accordingly.

---

## Quick Start

```bash
# Install template via ipa-ck CLI
ipa-ck init

# Start with Lean analysis
/lean [your idea]           # MVP definition + phase breakdown

# Generate IPA docs (Staged with Gates)
/ipa:spec                   # Requirements + UI spec (GATE 2)
/ipa:design                 # Mockups (GATE 3)
/ipa:detail                 # API + DB specs

# OR import external SRS (from Gemini Deep Research, etc.)
/ipa:import @external-srs.md

# Create implementation plan
/plan

# After implementation
/ipa-docs:sync              # Sync docs with code
```

## Features

- **IPA Documentation Workflow** - Standardized docs (SRD, UI_SPEC, API_SPEC, DB_DESIGN)
- **Lean Analysis** - MVP definition with problem/features/assumptions + Phase Breakdown
- **Validation Gates** - Checkpoints (GATE 1/2/3) to prevent building the wrong thing
- **Mockup Analysis** - AI-powered design spec extraction from HTML mockups
- **Multi-Model Task Distribution** - Phase-first structure with layer files
- **Validation** - IPA docs consistency & traceability checks

---

## Process Overview

### Complete Flow Diagram (v3.0)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                     IPA + LEAN WORKFLOW (v3.0)                              │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────────┐                                                           │
│  │    IDEA     │                                                           │
│  └──────┬──────┘                                                           │
│         ↓                                                                   │
│  ┌─────────────┐     ┌──────────────────────────────────────┐              │
│  │   /lean     │ ──→ │ MVP/Feature Analysis                 │              │
│  └──────┬──────┘     │ • Problem statement                  │              │
│         │            │ • Features (🆕/🔄/🗑️)                │              │
│         │            │ • Implementation Phases (NEW)        │              │
│         │            │ • Plan Structure Preview (NEW)       │              │
│         │            └──────────────────────────────────────┘              │
│         ↓                                                                   │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ 🚦 GATE 1: Scope Validation                                          │   │
│  │ - [ ] Users confirmed problem (3+ interviews)                        │   │
│  │ - [ ] Scope acceptable (≤ 3 phases)                                  │   │
│  │ - [ ] Assumptions documented                                         │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│         ↓                                                                   │
│  ╔═════════════════════════════════════════════════════════════════════╗   │
│  ║                     STAGE 1: SPECIFICATION                           ║   │
│  ╠═════════════════════════════════════════════════════════════════════╣   │
│  ║                                                                      ║   │
│  ║   /ipa:spec ──→ docs/SRD.md + docs/UI_SPEC.md                       ║   │
│  ║                                                                      ║   │
│  ╚═════════════════════════════════════════════════════════════════════╝   │
│         ↓                                                                   │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ 🚦 GATE 2: Requirements Validation                                   │   │
│  │ - [ ] Stakeholders reviewed SRD                                      │   │
│  │ - [ ] Feature priorities confirmed                                   │   │
│  │ - [ ] Scope matches /lean output                                     │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│         ↓                                                                   │
│  ╔═════════════════════════════════════════════════════════════════════╗   │
│  ║                     STAGE 2: DESIGN                                  ║   │
│  ╠═════════════════════════════════════════════════════════════════════╣   │
│  ║                                                                      ║   │
│  ║   /ipa:design ──→ prototypes/html-mockups/                          ║   │
│  ║   [Optional] /ipa:mockup-analyze ──→ docs/UI_DESIGN_SPEC.md         ║   │
│  ║                                                                      ║   │
│  ╚═════════════════════════════════════════════════════════════════════╝   │
│         ↓                                                                   │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ 🚦 GATE 3: Design Validation                                         │   │
│  │ - [ ] User testing completed (5+ users)                              │   │
│  │ - [ ] Usability issues logged and addressed                          │   │
│  │ - [ ] Design matches MVP scope                                       │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│         ↓                                                                   │
│  ╔═════════════════════════════════════════════════════════════════════╗   │
│  ║                     STAGE 3: DETAIL                                  ║   │
│  ╠═════════════════════════════════════════════════════════════════════╣   │
│  ║                                                                      ║   │
│  ║   /ipa:detail ──→ docs/API_SPEC.md + docs/DB_DESIGN.md              ║   │
│  ║                                                                      ║   │
│  ╚═════════════════════════════════════════════════════════════════════╝   │
│         ↓                                                                   │
│  ╔═════════════════════════════════════════════════════════════════════╗   │
│  ║                     PLANNING & IMPLEMENTATION                        ║   │
│  ╠═════════════════════════════════════════════════════════════════════╣   │
│  ║                                                                      ║   │
│  ║   /plan ──→ Phase breakdown (from multi-model-task-distribution)    ║   │
│  ║       ↓                                                              ║   │
│  ║   /code phase-01 → phase-02 → ...                                   ║   │
│  ║       ↓                                                              ║   │
│  ║   /ipa-docs:sync (after user verification)                              ║   │
│  ║                                                                      ║   │
│  ╚═════════════════════════════════════════════════════════════════════╝   │
│         ↓                                                                   │
│  ┌─────────────┐                                                           │
│  │   LAUNCH    │                                                           │
│  └──────┬──────┘                                                           │
│         ↓                                                                   │
│  ┌─────────────┐     ┌──────────────────────────────────────┐              │
│  │ /lean:      │ ──→ │ Usage Analysis                       │              │
│  │ analyze-    │     │ • Feature adoption                   │              │
│  │ usage       │     │ • Drop-off points                    │              │
│  └──────┬──────┘     │ • Recommendations                    │              │
│         │            └──────────────────────────────────────┘              │
│         ↓                                                                   │
│  ┌─────────────┐                                                           │
│  │   /lean     │ ──→ Feature Mode (next iteration)                        │
│  │ [improve]   │                                                           │
│  └─────────────┘                                                           │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Slash Commands

### Pre-Development (Analysis & Planning)

#### Lean Commands

| Command | Output | Description | When to Use |
|---------|--------|-------------|-------------|
| `/lean:user-research` | USER_RESEARCH.md | Personas, journey maps | Before /lean (optional) |
| `/lean` | MVP/Feature analysis | MVP definition OR feature improvement (auto-detect) | Idea validation, feature planning |
| `/lean:analyze-usage` | usage-analysis-*.md | Post-launch usage analytics | After launch (30+ days) |

#### IPA Documentation (Staged)

| Command | Output | Description | Gate |
|---------|--------|-------------|------|
| `/ipa:spec` | SRD.md + UI_SPEC.md | Requirements + UI specs | GATE 2 |
| `/ipa:design` | html-mockups/ | Generate HTML mockups | GATE 3 |
| `/ipa:mockup-analyze` | UI_DESIGN_SPEC.md | Design tokens from mockups | — |
| `/ipa:detail` | API_SPEC.md + DB_DESIGN.md | API contracts, DB schema | — |
| `/ipa:import` | IPA docs from external | Import external SRS/requirements | — |
| `/ipa:init` | All docs | Reverse engineer from code | Existing project |
| `/ipa:validate` | Validation report | Check consistency & IDs | After docs generated |

#### IPA Docs Management

| Command | Output | Description |
|---------|--------|-------------|
| `/ipa-docs:sync` | Updated docs | Sync docs with implementation |
| `/ipa-docs:split` | Modular folders | Split large docs (>500 lines) |

### Legacy (Power Users)

| Command | Output | Note |
|---------|--------|------|
| `/ipa:all` | All docs | ⚠️ Skips validation gates |
| `/ipa:srd` | SRD.md | Use `/ipa:spec` instead |
| `/ipa:bd` | UI_SPEC.md | Use `/ipa:spec` instead |
| `/ipa:dd` | API + DB | Use `/ipa:detail` instead |

---

## Validation Gates

Lean methodology requires validation at key checkpoints to avoid building the wrong thing.

### Gate Summary

| Gate | After Command | Purpose | Minimum Validation |
|------|---------------|---------|-------------------|
| GATE 1 | `/lean` | Scope validation | 3+ user interviews |
| GATE 2 | `/ipa:spec` | Requirements validation | Stakeholder review |
| GATE 3 | `/ipa:design` | Design validation | 5+ user testing |

### Gate 1: Scope Validation

**When:** After `/lean` output, before `/ipa:spec`

**Checklist:**
- [ ] Talked to 3+ potential users about the problem
- [ ] Users confirmed this is a real pain point
- [ ] MVP scope acceptable (≤ 3 phases recommended)
- [ ] Assumptions documented for later validation

**If scope too large:** Cut features before proceeding

### Gate 2: Requirements Validation

**When:** After `/ipa:spec` output, before `/ipa:design`

**Checklist:**
- [ ] Stakeholders reviewed SRD.md
- [ ] Feature priorities (P1/P2/P3) confirmed
- [ ] Scope still matches /lean output
- [ ] No scope creep

### Gate 3: Design Validation

**When:** After `/ipa:design` output, before `/ipa:detail`

**Checklist:**
- [ ] User testing completed with 5+ users
- [ ] Usability issues logged
- [ ] Critical issues addressed in mockups
- [ ] Design matches MVP scope (no gold plating)

### Skipping Gates

Use `/ipa:all` to skip gates (power users only). This runs the full sequence without pause:

```
/ipa:all = /ipa:spec → /ipa:design → /ipa:detail (no gates)
```

⚠️ **Warning:** Skipping gates increases risk of building wrong features.

---

## Workflow Scenarios

### Scenario 1: New Project (Full Process with Gates)

```
┌─────────────────────────────────────────────────────────────────────┐
│ NEW PROJECT: From Idea to Implementation (with Validation Gates)    │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  Step 1: Lean Analysis                                              │
│  ─────────────────────                                              │
│  /lean "Build a task management app for remote teams"              │
│       ↓                                                             │
│  Output:                                                            │
│  • MVP definition with features, assumptions                       │
│  • Implementation Phases (suggested)                               │
│  • Plan Structure Preview                                          │
│  • GATE 1 Checklist                                                │
│                                                                     │
│  🚦 GATE 1: Validate scope before proceeding                       │
│  - Talk to 3+ potential users                                       │
│  - Confirm scope is acceptable (≤ 3 phases)                        │
│                                                                     │
│  Step 2: Specification                                              │
│  ─────────────────────                                              │
│  /ipa:spec                                                          │
│       ↓                                                             │
│  Output: docs/SRD.md + docs/UI_SPEC.md + GATE 2 Checklist          │
│                                                                     │
│  🚦 GATE 2: Stakeholder review                                      │
│  - Review SRD with team/stakeholders                                │
│  - Confirm feature priorities                                       │
│                                                                     │
│  Step 3: Design Mockups                                             │
│  ─────────────────────                                              │
│  /ipa:design https://linear.app                                     │
│       ↓                                                             │
│  Output: prototypes/html-mockups/ + GATE 3 Checklist               │
│                                                                     │
│  🚦 GATE 3: User testing                                            │
│  - Test mockups with 5+ users                                       │
│  - Log and address usability issues                                 │
│                                                                     │
│  Step 4: Detail Design                                              │
│  ─────────────────────                                              │
│  /ipa:detail                                                        │
│       ↓                                                             │
│  Output: docs/API_SPEC.md + docs/DB_DESIGN.md                      │
│                                                                     │
│  Step 5: Implementation                                             │
│  ─────────────────────                                              │
│  /plan:hard [feature]                                               │
│       ↓                                                             │
│  /code phase-01/core.md → /ipa-docs:sync                               │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Directory Structure

```
your-project/
├── .claude/
│   ├── CLAUDE.md                    # Project config (copy this!)
│   ├── skills/
│   │   ├── ipa-planner/             # IPA-aware planning (converted from agent)
│   │   ├── ipa-docs/                # IPA-aware docs sync (converted from agent)
│   │   ├── ipa-validator/           # IPA validation workflow
│   │   ├── lean-analyst/            # MVP analysis workflow
│   │   └── context-aware-planning/  # @path design context parsing
│   ├── commands/
│   │   ├── ipa-docs/
│   │   │   ├── sync.md              # /ipa-docs:sync
│   │   │   └── split.md             # /ipa-docs:split
│   │   ├── lean.md                  # /lean
│   │   └── ipa/
│   │       ├── spec.md              # /ipa:spec (Stage 1)
│   │       ├── design.md            # /ipa:design (Stage 2)
│   │       ├── detail.md            # /ipa:detail (Stage 3)
│   │       ├── import.md            # /ipa:import (External SRS)
│   │       ├── init.md              # /ipa:init
│   │       ├── mockup-analyze.md    # /ipa:mockup-analyze
│   │       ├── validate.md          # /ipa:validate
│   │       ├── srd.md               # /ipa:srd (Legacy)
│   │       ├── bd.md                # /ipa:bd (Legacy)
│   │       ├── dd.md                # /ipa:dd (Legacy)
│   │       └── all.md               # /ipa:all (Legacy)
│   └── workflows/
│       └── multi-model-task-distribution.md
├── docs/                            # IPA docs (generated)
│   ├── SRD.md
│   ├── UI_SPEC.md
│   ├── UI_DESIGN_SPEC.md
│   ├── API_SPEC.md
│   └── DB_DESIGN.md
├── prototypes/html-mockups/         # UI mockups
└── plans/                           # Implementation plans
```

---

## IPA Docs vs Global /docs:init

> **Warning:** Nếu bạn có global `/docs:init` command, cần hiểu sự khác biệt để tránh overlap.

### So Sánh Docs Output

| IPA Template | Global /docs:init | Overlap? |
|--------------|-------------------|----------|
| `SRD.md` (Requirements, FR-xx, S-xx, E-xx) | `project-overview-pdr.md` (PDR) | ⚠️ HIGH |
| `API_SPEC.md` + `DB_DESIGN.md` | `system-architecture.md` | ⚠️ MEDIUM |
| `UI_SPEC.md` (screens, flows) | `design-guidelines.md` | ⚠️ MEDIUM |
| — | `codebase-summary.md` | ✅ Unique |
| — | `code-standards.md` | ✅ Unique |
| — | `deployment-guide.md` | ✅ Unique |
| — | `project-roadmap.md` | ✅ Unique |
| Traceability (FR→Screen→API→DB) | — | ✅ Unique |

### Complementary Approach (Option B)

Nếu cần cả hai, dùng **IPA cho specs** và **chỉ một số global docs cho operational info**:

```
docs/
├── SRD.md              ← IPA: Requirements source of truth
├── UI_SPEC.md          ← IPA: UI specs source of truth
├── API_SPEC.md         ← IPA: API contracts source of truth
├── DB_DESIGN.md        ← IPA: Schema source of truth
│
├── codebase-summary.md ← Global: Code navigation (unique, no overlap)
├── code-standards.md   ← Global: Coding conventions (unique, no overlap)
├── deployment-guide.md ← Global: DevOps (unique, no overlap)
└── project-roadmap.md  ← Global: Planning (unique, no overlap)
```

---

## Template Version

**Version:** 3.2
**Last Updated:** 2026-01-18
**Changes:**
- Added Custom Paths Support for `.ck.json` configuration
- Renamed README.md to IPA-WORKFLOW.md to avoid conflicts
- Added Command Prefix Note for CK `--prefix` users
- Optimized CLAUDE.md for better token efficiency
- Introduced `/ipa:spec` and `/ipa:detail` for clearer stages
- Added `/ipa:import` for external SRS import
- Added `/ipa-docs:split` for modular docs structure
