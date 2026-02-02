---
name: ipa:all
description: Generate all IPA docs (skips validation gates) - DEPRECATED
user-invocable: true
---

> **⚠️ DEPRECATION WARNING**
>
> This command skips validation gates (GATE 1/2/3).
>
> **Recommended flow:**
> ```
> /lean → /ipa:spec → /ipa:design → /ipa:detail
> ```
>
> Use `/ipa:all` only for:
> - Rapid prototyping (throwaway code)
> - Existing projects with established docs
> - Power users who understand the risks

---

## Purpose

Generate all IPA documentation in sequence:
1. SRD (System Requirement Definition)
2. BD (Basic Design / UI_SPEC)
3. DD (Detail Design / API_SPEC + DB_DESIGN)

---

## Input

<requirements>
$ARGUMENTS
</requirements>

If empty, look for:
- `docs/requirements.md`
- `docs/PRD.md`
- Ask user for requirements

---

## Workflow

### Step 1: Generate SRD

Execute `/ipa:srd` logic:
- Read requirements
- Generate `docs/SRD.md` with 14 IPA sections
- Ask user to review

**Wait for user approval before continuing.**

### Step 2: Generate Basic Design

Execute `/ipa:bd` logic:
- Read `docs/SRD.md`
- Generate `docs/UI_SPEC.md`
- Optionally generate `ui-mockup/*.html`
- Ask user to review

**Wait for user approval before continuing.**

### Step 3: Generate Detail Design

Execute `/ipa:dd` logic:
- Read `docs/SRD.md` + `docs/UI_SPEC.md`
- Generate `docs/API_SPEC.md`
- Generate `docs/DB_DESIGN.md`
- Ask user to review

**Wait for user approval before continuing.**

### Step 4: Auto-Validate (Built-in)

Execute `/ipa:validate` logic automatically:
- Check ID consistency (FR-xx, S-xx, E-xx)
- Validate traceability chain
- Check cross-references
- Report any errors/warnings

```
✓ Validation Summary:
  - Features (FR): 10 ✓
  - Screens (S): 8 ✓
  - Entities (E): 6 ✓
  - Errors: 0
  - Warnings: 2 (orphan IDs)
  - Status: PASS
```

If errors found, prompt user to fix before proceeding.

---

## Output Summary

After completion:
```
docs/
├── SRD.md           # System Requirement Definition
├── UI_SPEC.md       # Basic Design (screens)
├── API_SPEC.md      # Detail Design (API)
├── DB_DESIGN.md     # Detail Design (DB)
└── tech-stack.md    # (if created)

ui-mockup/           # (optional)
├── login.html
├── dashboard.html
└── ...
```

---

## Next Steps

After all docs generated and validated:
1. Review validation report (auto-generated)
2. Fix any errors if found
3. Run `/plan` to create implementation tasks
4. Tasks will reference docs/ (DRY)

**Manual re-validation:**
```bash
# Run if you edit docs manually
/ipa:validate
```

---

## Traceability Chain

```
Requirements
    ↓
SRD.md (FR-xx, S-xx, E-xx)
    ↓
UI_SPEC.md (S-xx → Screen specs)
    ↓
API_SPEC.md (API ↔ FR-xx ↔ S-xx)
DB_DESIGN.md (Table ↔ E-xx)
    ↓
/plan → Tasks ref docs/
    ↓
/code → Implementation
    ↓
/ipa-docs:sync → Keep docs accurate
```

**IMPORTANT:** Do not implement code. Only generate documentation.
