---
name: ipa:help
description: IPA workflow quick reference with warnings
user-invocable: true
---

# /ipa:help

Display IPA workflow cheatsheet with important warnings.

## Output

```
┌─────────────────────────────────────────────────────────────┐
│                    IPA QUICK REFERENCE                       │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  🚀 FAST MODE (Power Users)                                 │
│  ─────────────────────────────────────────                  │
│  /ipa:fast "idea"     Full workflow, no prompts             │
│  ⚠️ Skips all gates - use only when confident               │
│                                                             │
│  📋 STEP-BY-STEP (Recommended)                              │
│  ─────────────────────────────────────────                  │
│  /lean "idea"         → MVP analysis          [GATE 1]      │
│  /ipa:spec            → SRD + UI_SPEC         [GATE 2]      │
│  /ipa:design          → HTML mockups          [GATE 3]      │
│  /ipa:detail          → API_SPEC + DB_DESIGN               │
│  /plan → /code        → Implementation                      │
│                                                             │
│  🔧 UTILITIES                                               │
│  ─────────────────────────────────────────                  │
│  /ipa:init            Extract docs from existing code       │
│  /ipa:import @file    Import external SRS document          │
│  /ipa:validate        Check traceability matrix             │
│  /ipa-docs:sync       Sync docs with implementation         │
│  /ipa:start           Interactive wizard                    │
│                                                             │
└─────────────────────────────────────────────────────────────┘

⚠️ CRITICAL WARNINGS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1. PLANNING WITH CONTEXT (@path)
   ─────────────────────────────
   ALWAYS include docs + mockups when planning:

   ✅ CORRECT:  /plan @docs/ @prototypes/html-mockups/
   ❌ WRONG:    /plan "implement feature"

   Why? Ensures:
   • Traceability: FR-xx → S-xx → E-xx → T-xx
   • Accurate UI: Code matches mockup exactly
   • Design tokens: Colors, fonts, spacing applied

2. DOCS SYNC REQUIRES HUMAN REVIEW
   ─────────────────────────────────
   After /code, run: /ipa-docs:sync

   ⚠️ REVIEW CHANGES before accepting
   ⚠️ Never auto-approve without checking

3. GATE VALIDATION
   ─────────────────
   Gates are checkpoints for quality:

   GATE 1: After /lean
   • 3+ user interviews about problem
   • Scope ≤ 3 phases

   GATE 2: After /ipa:spec
   • Stakeholder reviewed SRD
   • Priorities confirmed (P1/P2/P3)

   GATE 3: After /ipa:design
   • 5+ user testing sessions
   • Usability issues addressed

   Skip with --fast flag (not recommended for new projects)

4. TRACEABILITY IDs
   ─────────────────
   Every element has an ID for tracking:

   FR-xx  → Functional Requirement (SRD)
   S-xx   → Screen (UI_SPEC)
   E-xx   → API Endpoint (API_SPEC)
   T-xx   → Database Table (DB_DESIGN)

   Check with: /ipa:validate

💡 TIPS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

• First time? Run /ipa:start for guided setup
• Add --fast to skip gate prompts: /lean --fast
• Large docs? Split with: /ipa-docs:split API_SPEC
• External SRS? Import with: /ipa:import @file.md
• Check coverage: /ipa:validate shows traceability matrix

📚 WORKFLOWS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

New Project (step-by-step):
  /lean → /ipa:spec → /ipa:design → /ipa:detail → /plan @docs/ @prototypes/

New Project (fast):
  /ipa:fast "idea" → /plan @docs/ @prototypes/

Existing (no docs):
  /ipa:init → /lean [feature] → /plan @docs/

Existing (has docs):
  /lean [feature] → /plan @docs/ → /code → /ipa-docs:sync

Import external:
  /ipa:import @srs.md → /ipa:design → /ipa:detail → /plan
```
