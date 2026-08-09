---
name: "source-command-ipa-validate"
description: "Validate IPA documentation consistency and traceability"
---

# source-command-ipa-validate

Use this skill when the user asks to run the migrated source command `ipa-validate`.

## Command Template

## Purpose

Run IPA validation to check documentation consistency, traceability, and completeness.

## When to Use

| Scenario | Auto/Manual | Notes |
|----------|-------------|-------|
| After `/ipa:all` | Auto | Built-in, runs automatically |
| After `/ipa:init` | Auto | Built-in, runs automatically |
| After manual doc edits | **Manual** | Run `/ipa:validate` explicitly |
| Before `/plan` | Manual | Recommended quality gate |
| After `/ipa-docs:sync` | Manual | Verify sync completeness |

**Note:** `/ipa:all` and `/ipa:init` run validation automatically. Use this command manually only when you edit docs or want to re-verify.

## Prerequisites

IPA docs must exist:
- `docs/SRD.md`
- `docs/UX_SPEC.md`
- `docs/INTERFACE_SPEC.md`
- `docs/DB_DESIGN.md`

## Workflow

### Step 1: Load Skill
Activate `ipa-validator` skill from `.Codex/skills/ipa-validator/`

### Step 2: Check Docs Exist
```
docs/
├── SRD.md           ✓ or ✗
├── UX_SPEC.md       ✓ or ✗
├── INTERFACE_SPEC.md ✓ or ✗
└── DB_DESIGN.md     ✓ or ✗
```

If any missing, report and stop.

### Step 3: Extract IDs from SRD
Parse tables for:
- FR-xx (Feature List)
- S-xx (Screen List)
- E-xx (Entity List)
- B-xx (Batch List)
- R-xx (Report List)
- IF-xx (Integration List)

### Step 4: Validate Cross-References
Check each doc references valid SRD IDs:
- UX_SPEC.md → S-xx refs
- INTERFACE_SPEC.md → FR-xx, S-xx refs
- DB_DESIGN.md → E-xx refs

### Step 5: Check Status Tracking
Verify INTERFACE_SPEC.md Endpoint Matrix has status column with valid values: ⏳, ✅, 🔄

### Step 6: Generate Report
Output validation report with:
- Summary (counts, status)
- Errors (blocking issues)
- Warnings (non-blocking)
- Recommendations
- Traceability Matrix

## Output

```markdown
## IPA Validation Report

### Summary
- Total Features (FR): X
- Total Screens (S): X
- Total Entities (E): X
- Errors: X
- Warnings: X
- Status: PASS / FAIL

### Details
[...see ipa-validator skill for format...]
```

## Usage

```bash
# After manual edits to docs
/ipa:validate

# Before planning (quality gate)
/ipa:validate
/plan

# After sync to verify
/ipa-docs:sync
/ipa:validate
```

**Note:** No need to run after `/ipa:all` or `/ipa:init` - they auto-validate.

**IMPORTANT:** This command only validates. It does not modify docs.
