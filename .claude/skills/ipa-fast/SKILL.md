---
name: ipa:fast
description: Run full IPA workflow with minimal prompts (power users)
user-invocable: true
argument-hint: "\"raw requirement\" [@url] [@image]"
allowed-tools:
  - Read
  - Write
  - Glob
  - Grep
  - WebSearch
  - WebFetch
  - AskUserQuestion
  - Task
  - Bash
---

# /ipa:fast

Fast mode runs the complete IPA workflow in one command, skipping all gate prompts.

## Warning

This command skips all validation gates. Use only when:
- You're experienced with IPA workflow
- Project scope is well understood
- You accept the risk of missing validation steps

For new projects or complex requirements, use step-by-step commands instead.

## Input Types (v1.3.0)

**Supports 3 input types, individually or combined:**

| Input | Prefix | Purpose | Tool |
|-------|--------|---------|------|
| Raw requirement | (none) | Text describing the feature/project | Direct parse |
| URL reference | `@https://...` | Design inspiration from website | `WebFetch` |
| Image reference | `@./path.png` | Design inspiration from screenshot | `Read` (vision) |

### Examples

```bash
# Raw requirement only
/ipa:fast "Build a task management app for remote teams"

# Raw requirement + URL reference
/ipa:fast "Build a SaaS dashboard" @https://stripe.com/billing

# Raw requirement + image reference
/ipa:fast "Build a dashboard" @./design-mockup.png

# Raw requirement + URL + image (all 3)
/ipa:fast "Build a FinOps dashboard" @https://stripe.com @./color-palette.png

# URL only (requirement inferred from reference)
/ipa:fast @https://linear.app

# Image only
/ipa:fast @./existing-design.png
```

## Flow

```
/ipa:fast "requirement" [@url] [@image]
    ↓
1. /lean "requirement" --fast (GATE 1 skipped)
    ↓
2. /ipa:spec "requirement" @url @image --fast (GATE 2 skipped)
   → Design System extracted from references
    ↓
3. /ipa:design --fast (GATE 3 skipped)
   → Prototypes generated from Design System
    ↓
4. /ipa:detail
    ↓
Output: All IPA docs generated
    ↓
Final: "Review generated docs. Ready for /plan?"
```

## Execution

### Step 1: Run Lean Analysis
Execute `/lean` with `--fast` flag internally:
- Skip GATE 1 prompt
- Log warning: "GATE 1 (Scope Validation) skipped"

### Step 2: Run Spec Generation
Execute `/ipa:spec` with `--fast` flag:
- Skip GATE 2 prompt
- Log warning: "GATE 2 (Spec Validation) skipped"

### Step 3: Run Design Generation
Execute `/ipa:design` with `--fast` flag:
- Skip GATE 3 prompt
- Log warning: "GATE 3 (Design Validation) skipped"

### Step 4: Run Detail Design
Execute `/ipa:detail`:
- Generate API_SPEC.md
- Generate DB_DESIGN.md

### Step 5: Final Summary

Output summary:
```
IPA Fast Mode Complete

Generated docs:
- docs/SRD.md
- docs/UI_SPEC.md
- docs/API_SPEC.md
- docs/DB_DESIGN.md
- prototypes/html-mockups/

Skipped gates: GATE 1, GATE 2, GATE 3

Next steps:
1. Review generated docs for accuracy
2. Run /ipa:validate to check traceability
3. Run /plan @docs/ @prototypes/ to create implementation plan
```

## Usage

```bash
# Raw requirement only
/ipa:fast "Build a task management app for remote teams"

# With URL reference (design inspiration)
/ipa:fast "Build a SaaS dashboard" @https://stripe.com/billing

# With image reference
/ipa:fast "Build a dashboard" @./mockup.png

# All 3 inputs combined
/ipa:fast "Build a FinOps dashboard" @https://stripe.com @./colors.png
```

## Alternative: Flag-based

Individual commands also support `--fast` flag:
```bash
/lean --fast        # Skip GATE 1
/ipa:spec --fast    # Skip GATE 2
/ipa:design --fast  # Skip GATE 3
```

## When NOT to use

- First time using IPA workflow
- Complex enterprise projects
- Projects with many stakeholders
- When user research is incomplete
