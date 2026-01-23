# CLAUDE.md

<!-- IPA-TEMPLATE-START -->
<!-- DO NOT EDIT THIS SECTION - Managed by ipa-ck -->

AI-facing guidance for Claude Code with IPA (Japan Standard) documentation workflow.

---

## IPA DOCUMENTATION WORKFLOW

### Documentation Flow

**New Project:**
```
/lean:user-research → docs/USER_RESEARCH.md (optional)
    ↓
/lean [idea] → MVP Analysis + GATE 1
    ↓
/ipa:spec → docs/SRD.md + docs/UI_SPEC.md + GATE 2
    ↓
/ipa:design → prototypes/html-mockups/ + GATE 3
    ↓
/ipa:mockup-analyze → docs/UI_DESIGN_SPEC.md
    ↓
/ipa:detail → docs/API_SPEC.md, docs/DB_DESIGN.md
    ↓
/plan → /code → /docs:sync → Launch MVP
    ↓
/lean:analyze-usage → Next iteration
```

**Existing Project:** `/lean [feature]` → `/plan` → `/code` → `/docs:sync`

**No docs:** `/ipa:init` → Extract docs → Continue above

---

## SLASH COMMANDS

### Lean Commands

| Command | Output |
|---------|--------|
| `/lean:user-research` | docs/USER_RESEARCH.md |
| `/lean` | MVP/Feature analysis + GATE 1 |
| `/lean:analyze-usage` | Post-launch analytics |

### IPA Commands

| Command | Output |
|---------|--------|
| `/ipa:init` | Extract docs from existing code |
| `/ipa:spec` | SRD.md + UI_SPEC.md + GATE 2 |
| `/ipa:design` | prototypes/html-mockups/ + GATE 3 |
| `/ipa:detail` | API_SPEC.md + DB_DESIGN.md |
| `/ipa:mockup-analyze` | UI_DESIGN_SPEC.md |
| `/ipa:validate` | Validation report |
| `/docs:sync` | Sync docs with implementation |

### Validation Gates

| Gate | Checklist |
|------|-----------|
| GATE 1 | 3+ user interviews, scope ≤ 3 phases |
| GATE 2 | Stakeholder review, priorities confirmed |
| GATE 3 | 5+ user testing, issues addressed |

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

## PRINCIPLES

- **YAGNI** - You Aren't Gonna Need It
- **KISS** - Keep It Simple, Stupid
- **DRY** - Don't Repeat Yourself

---

## QUALITY GATES

- [ ] Docs generated via /ipa:* commands
- [ ] /ipa:validate passes
- [ ] Plan refs docs/ (no duplication)
- [ ] /docs:sync after implementation

---

## CONTEXT-AWARE PLANNING

Use `@path` syntax: `/plan:hard implement login @prototypes/html-mockups/login`

See: `.claude/skills/ipa-context-aware-planning/SKILL.md`

---

## REFERENCES

- Workflow: `.claude/workflows/multi-model-task-distribution.md`
- Skills: `.claude/skills/`
- Commands: `.claude/commands/`

<!-- IPA-TEMPLATE-END -->