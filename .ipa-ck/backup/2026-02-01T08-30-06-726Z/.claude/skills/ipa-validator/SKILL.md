---
name: ipa-validator
description: Validate IPA documentation consistency and traceability. Use after generating IPA docs or before implementation.
---

# IPA Validator

Validates IPA documentation for consistency, traceability, and completeness.

## When to Use

- After `/ipa:all` or `/ipa:init` generates docs
- Before `/plan` to ensure docs are valid
- After `/ipa-docs:sync` to verify sync completeness

## Validation Scope

### Required Docs
- `docs/SRD.md` - System Requirement Definition
- `docs/UX_SPEC.md` - UX Specification (Basic Design)
- `docs/INTERFACE_SPEC.md` - Interface Specification (Detail Design)
- `docs/DB_DESIGN.md` - Database Design (Detail Design)

### Validation Rules

Load: `references/validation-rules.md`

### Traceability Check

Load: `references/traceability-check.md`

## Workflow

1. **Check docs exist** - Verify all required IPA docs present
2. **Extract IDs** - Parse FR-xx, S-xx, E-xx from SRD
3. **Validate refs** - Check cross-references in other docs
4. **Check status** - Verify Endpoint Matrix status tracking
5. **Generate report** - Output validation results

## Output

Validation report with:
- ID consistency check
- Traceability chain check
- Cross-reference validation
- Status tracking validation
- Recommendations for fixes

## Usage

```bash
# Run validation
/ipa:validate

# Or invoke skill directly
"Validate IPA docs"
```
