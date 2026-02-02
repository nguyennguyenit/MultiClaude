---
name: ipa:start
description: Interactive wizard to start IPA workflow
user-invocable: true
---

# /ipa:start

Guide user through IPA workflow based on project type.

## Flow

### Step 1: Project Type Detection

Use AskUserQuestion to determine project type:

```
What type of project are you starting?

1. **New project** - Building from scratch
   → Full workflow: /lean → /ipa:spec → /ipa:design → /ipa:detail

2. **Existing project (no IPA docs)** - Code exists, need docs
   → Extract docs: /ipa:init → /lean [feature] → /plan

3. **Existing project (has IPA docs)** - Add feature/improvement
   → Feature mode: /lean [feature] → /plan → /code

4. **Import external SRS** - Have requirements document
   → Import: /ipa:import @path/to/srs.md → continue workflow
```

### Step 2: Workflow Guide

Based on selection, output next steps with warnings.

---

## Output Templates

### For New Project

```markdown
## 🚀 New Project Workflow

### Your Path
```
/lean "your idea"           ← Start here
    ↓ [GATE 1: Scope]
/ipa:spec                   → SRD.md + UI_SPEC.md
    ↓ [GATE 2: Spec]
/ipa:design                 → HTML mockups
    ↓ [GATE 3: Design]
/ipa:detail                 → API_SPEC.md + DB_DESIGN.md
    ↓
/plan @docs/ @prototypes/   → Implementation plan
```

### ⚠️ IMPORTANT TIPS

**1. GATE VALIDATION (Don't skip on first project)**
- GATE 1: Validate scope with 3+ user interviews
- GATE 2: Get stakeholder sign-off on SRD
- GATE 3: Test mockups with 5+ users

**2. PLANNING WITH CONTEXT**
When running /plan, ALWAYS include design context:

```bash
✅ /plan @docs/ @prototypes/html-mockups/
❌ /plan "implement feature"
```

This ensures:
- Traceability (FR → Screen → API → DB)
- Accurate UI code matching mockups
- Design tokens applied correctly

**3. DOCS SYNC**
After /code, run `/ipa-docs:sync`
⚠️ Review changes before accepting

### Alternative: Fast Mode
If experienced: `/ipa:fast "your idea"` (skips all gates)

### Next Command
```bash
/lean "describe your idea here"
```
```

---

### For Existing Project (No Docs)

```markdown
## 📦 Existing Project (No Docs) Workflow

### Your Path
```
/ipa:init                   ← Start here (extract docs from code)
    ↓
Review generated docs       → Fix inaccuracies
    ↓
/lean "feature idea"        → Feature analysis
    ↓
/plan @docs/                → Implementation plan
```

### ⚠️ IMPORTANT TIPS

**1. REVIEW GENERATED DOCS**
`/ipa:init` infers docs from code - may not be 100% accurate.
Review and fix before proceeding.

**2. PLANNING WITH CONTEXT**
```bash
✅ /plan [feature] @docs/
❌ /plan "implement feature"
```

**3. CHECK TRACEABILITY**
After changes: `/ipa:validate`

### Next Command
```bash
/ipa:init
```
```

---

### For Existing Project (Has Docs)

```markdown
## ✨ Existing Project (Has Docs) Workflow

### Your Path
```
/lean "feature idea"        ← Start here
    ↓
/plan @docs/                → Implementation plan
    ↓
/code                       → Implementation
    ↓
/ipa-docs:sync              → Update docs
```

### ⚠️ IMPORTANT TIPS

**1. FEATURE MODE**
`/lean` auto-detects existing docs and runs in Feature Mode:
- Analyzes existing features
- Suggests improvements
- Identifies impacted components

**2. PLANNING WITH CONTEXT**
```bash
✅ /plan [feature] @docs/ @prototypes/
❌ /plan "implement feature"
```

**3. IF ADDING NEW SCREENS**
Run `/ipa:design "new screen"` first to create mockups.

### Next Command
```bash
/lean "describe your feature idea"
```
```

---

### For Import External SRS

```markdown
## 📄 Import External SRS Workflow

### Your Path
```
/ipa:import @path/to/srs.md ← Start here
    ↓
Review converted docs       → Fix format issues
    ↓
[GATE 2: Verify conversion]
    ↓
/ipa:design                 → Create mockups
    ↓
Continue normal workflow...
```

### ⚠️ IMPORTANT TIPS

**1. SUPPORTED FORMATS**
- Markdown (.md)
- PDF (via AI extraction)
- Plain text

**2. REVIEW CONVERSION**
External SRS may not map perfectly to IPA format.
Review FR-xx IDs and S-xx mappings.

**3. GATE 2 RECOMMENDED**
Get stakeholder sign-off on converted docs.

### Next Command
```bash
/ipa:import @path/to/your-srs-file.md
```
```

---

## Quick Reference

After completing wizard, suggest:
```
Need help anytime? Run /ipa:help for quick reference.
```
