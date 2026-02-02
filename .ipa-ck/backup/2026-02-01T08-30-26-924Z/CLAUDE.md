# CLAUDE.md

<!-- IPA-TEMPLATE-START -->
<!-- DO NOT EDIT THIS SECTION - Managed by ipa-ck -->

AI-facing guidance for Claude Code with IPA (Japan Standard) documentation workflow.

---

## ARCHITECTURE NOTE

**v1.3.0:** Skills-based architecture. All IPA functionality is implemented as skills in `.claude/skills/`.

**Slash Commands:** All `/ipa:*`, `/ipa-docs:*`, `/lean:*` commands are user-invocable skills.

---

## CUSTOM PATHS NOTE

**If using custom paths in `.ck.json`:**

```json
{
  "paths": {
    "ck-docs": "ck-docs",    // instead of "docs/"
    "ck-plans": "ck-plans"   // instead of "plans/"
  }
}
```

Replace `docs/` → your custom docs path, `plans/` → your custom plans path in all IPA commands.

**Example:** If `ck-docs: "ck-docs"`, then `/ipa:spec` outputs to `ck-docs/SRD.md` instead of `docs/SRD.md`.

---

## IPA DOCUMENTATION WORKFLOW

**New Project (Step-by-step):**
```
/lean [idea] → MVP Analysis + GATE 1
    ↓
/ipa:spec @url/@image → docs/SRD.md + docs/UI_SPEC.md (with Design System) + GATE 2
    ↓
/ipa:design → prototypes/ (implements Design System) + GATE 3
    ↓
/ipa:detail → docs/API_SPEC.md, docs/DB_DESIGN.md
    ↓
/plan @docs/ @prototypes/ → /code → /ipa-docs:sync → Launch MVP
```

**Design Reference Flow (NEW in v1.3.0):**
```
# With reference URL/image - design research in /ipa:spec
/ipa:spec @https://stripe.com   → UI_SPEC.md with extracted Design System
/ipa:spec @./design.png         → UI_SPEC.md with extracted Design System
                ↓
/ipa:design                     → prototypes/ (pure implementation)

# Without reference - WebSearch for design inspiration
/ipa:spec [feature-desc]        → Proposes 3 design options → User selects → UI_SPEC.md
```

**New Project (Fast mode - power users):**
```
/ipa:fast [idea] → All docs in one command (skips all gates)
    ↓
/plan @docs/ @prototypes/ → /code → /ipa-docs:sync
```

**External SRS:** `/ipa:import @external-srs.md` → Generate IPA docs from external requirements

**No docs:** `/ipa:init` → Extract docs from code

**Large docs (>500 lines):** `/ipa-docs:split API_SPEC` → Modular folder structure

**First time?** Run `/ipa:start` for interactive wizard

**Quick reference?** Run `/ipa:help` for cheatsheet with warnings

---

## SLASH SKILLS

### IPA Skills

| Command | Output |
|---------|--------|
| `/ipa:fast` | **Full workflow in one command (power users)** |
| `/ipa:start` | **Interactive wizard for beginners** |
| `/ipa:help` | **Quick reference + warnings** |
| `/ipa:spec` | SRD.md + UI_SPEC.md (with Design System) + GATE 2 |
| `/ipa:design` | prototypes/ (implements Design System) + GATE 3 |
| `/ipa:detail` | API_SPEC.md + DB_DESIGN.md |
| `/ipa:import` | Import external SRS → IPA docs |
| `/ipa:init` | Extract docs from existing code |
| `/ipa:validate` | Validation report + traceability matrix |

### IPA Docs Skills

| Command | Output |
|---------|--------|
| `/ipa-docs:sync` | Sync docs with implementation |
| `/ipa-docs:split` | Split large docs into modular folders |

### Lean Skills

| Command | Output |
|---------|--------|
| `/lean` | MVP/Feature analysis + GATE 1 |
| `/lean:user-research` | docs/USER_RESEARCH.md |
| `/lean:analyze-usage` | Post-launch analytics |

---

## ⚠️ CRITICAL: PLANNING WITH CONTEXT

When running `/plan*` commands, **ALWAYS include docs and mockups**:

```bash
# ✅ CORRECT - ensures traceability + accurate UI
/plan @docs/ @prototypes/html-mockups/

# ❌ WRONG - no context, loses traceability
/plan "implement feature"
```

**Why?**
- Traceability: FR-xx → S-xx → E-xx → T-xx maintained
- Accurate UI: Code matches mockup exactly
- Design tokens: Colors, fonts, spacing applied correctly

---

## PLANNING

**Before `/plan*`:** Read `.claude/workflows/multi-model-task-distribution.md`

| Command | When to Use |
|---------|-------------|
| `/plan` | Default entry |
| `/plan:fast` | Simple, understood task |
| `/plan:hard` | Complex, needs research |

### Phase Structure

```
plans/{date}-{slug}/
├── plan.md
└── phase-NN-{name}/
    ├── core.md   # Business logic
    ├── ui.md     # User interface
    ├── data.md   # Data storage
    └── tasks.md  # Fallback
```

**Execution:** Phases run sequentially. Within phase: data → core → ui

---

## VALIDATION GATES

| Gate | After | Checklist |
|------|-------|-----------|
| 1 | `/lean` | 3+ user interviews, scope ≤ 3 phases |
| 2 | `/ipa:spec` | Stakeholder review, priorities confirmed |
| 3 | `/ipa:design` | 5+ user testing, issues addressed |

---

## PRINCIPLES

YAGNI | KISS | DRY

---

## QUALITY CHECKLIST

- [ ] Docs via /ipa:* commands
- [ ] /ipa:validate passes
- [ ] Plan refs docs/ (no duplication)
- [ ] /ipa-docs:sync after implementation

---

## REFERENCES

- Workflow: `.claude/workflows/multi-model-task-distribution.md`
- Skills: `.claude/skills/`

<!-- IPA-TEMPLATE-END -->