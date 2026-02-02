---
name: ipa:validate
description: Validate IPA documentation consistency and traceability
user-invocable: true
---

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
Activate `ipa-validator` skill from `.claude/skills/ipa-validator/`

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

### Step 6: Build Traceability Matrix
Map each FR-xx to its implementations:
- Parse UI_SPEC.md for S-xx (Screen) refs to FR-xx
- Parse INTERFACE_SPEC.md for E-xx (Endpoint) refs to FR-xx
- Parse DB_DESIGN.md for T-xx (Table) refs to FR-xx
- Calculate coverage status per FR

### Step 7: Validate Gates
Check gate completion status (soft enforcement):
- GATE 1: Scope validation from /lean
- GATE 2: Spec validation from /ipa:spec
- GATE 3: Design validation from /ipa:design

### Step 8: Generate Report
Output validation report with:
- Summary (counts, status)
- Traceability Matrix
- Coverage Summary
- Gaps
- Gate Status
- Errors (blocking issues)
- Warnings (non-blocking)
- Recommendations

## Output

```markdown
## IPA Validation Report

### Summary
- Total Features (FR): X
- Total Screens (S): X
- Total Entities (E): X
- Total Endpoints (E-): X
- Total Tables (T): X
- Errors: X
- Warnings: X
- Status: PASS / FAIL

### Traceability Matrix

| FR ID | Screen | API Endpoint | DB Table | Status |
|-------|--------|--------------|----------|--------|
| FR-01 | S-01   | E-01         | T-01     | ✅ Full |
| FR-02 | S-02   | E-02, E-03   | T-01, T-02 | ✅ Full |
| FR-03 | S-03   | —            | —        | ⚠️ Partial |
| FR-04 | —      | —            | —        | ❌ Missing |

### Coverage Summary
- Requirements: 4 total
- Full coverage: 2 (50%)
- Partial coverage: 1 (25%)
- Missing coverage: 1 (25%)

### Gaps
- FR-03: Missing API endpoint mapping
- FR-04: Not mapped to any screen/API/DB

### Gate Status
[See Gate Validation section below]

### Details
[...see ipa-validator skill for format...]
```

## Traceability Matrix Details

### Coverage Status Definitions

| Status | Meaning |
|--------|---------|
| ✅ Full | FR mapped to Screen + Endpoint + Table |
| ⚠️ Partial | FR mapped to some but not all components |
| ❌ Missing | FR not mapped to any component |

### Bi-directional Traceability

**Forward Tracing (Requirements → Implementation):**
```
FR-01 → S-01 → E-01 → T-01 → TC-01 (Test Case)
```
- Verifies: Every requirement has implementation

**Backward Tracing (Implementation → Requirements):**
```
TC-01 ← T-01 ← E-01 ← S-01 ← FR-01
```
- Verifies: Every implementation traces to a requirement

**Orphan Detection:**
- Forward orphan: FR-xx with no downstream refs (missing impl)
- Backward orphan: S-xx/E-xx/T-xx with no upstream FR-xx (scope creep)

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
