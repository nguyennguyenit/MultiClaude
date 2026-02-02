---
name: ipa:design
description: Generate UI prototypes from UI_SPEC (pure implementation, no design research)
user-invocable: true
argument-hint: "[optional: style-preset or screen-fix]"
context: fork
allowed-tools: ["Read", "Write", "Bash", "Glob", "Grep", "AskUserQuestion", "Task"]
---

## ⛔ SPEC ADHERENCE (MANDATORY - READ FIRST)

**NON-NEGOTIABLE RULES:**

1. **Read `docs/UI_SPEC.md` COMPLETELY** before generating ANY screen
2. **Screen content MUST match UI_SPEC EXACTLY** - NO improvisation
3. **If UI_SPEC says "API Keys"** → output "API Keys" - NOT "Integrations"
4. **NO creative additions** beyond what spec defines
5. **If spec unclear** → output placeholder with `<!-- TODO: clarify in spec -->`

**VIOLATION = TASK FAILURE**

---

## Purpose

Generate **production-ready HTML/CSS/JS prototypes** from `docs/UI_SPEC.md`.

**Key Principle:** Implementation only, no design decisions. All design comes from UI_SPEC.

---

## Mandatory Checklist (MUST verify before completing)

- [ ] Read UI_SPEC.md completely FIRST
- [ ] `<body class="cjx-{stage}">` on every HTML file
- [ ] CJX comment header at top of each file
- [ ] All screens from UI_SPEC generated (count must match)
- [ ] Screen content matches UI_SPEC exactly
- [ ] **REAL SVG charts** - NO placeholder text
- [ ] Uses `app-layout`, `main-content`, `sidebar hide-mobile` classes
- [ ] README.md has FR mapping table

**DO NOT mark complete until ALL verified.**

---

## Workflow

```
1. Read docs/UI_SPEC.md completely
   ├── Count total screens
   ├── Note each screen's purpose
   └── Extract Design System tokens

2. For EACH screen in UI_SPEC:
   ├── Read screen spec section
   ├── Generate HTML matching spec EXACTLY
   ├── Apply CJX stage from spec
   └── Use layout classes from references

3. Generate shared files:
   ├── styles.css (design tokens from UI_SPEC)
   ├── components.css
   ├── interactions.js (CJX animations)
   └── README.md (FR mapping)

4. Validate:
   ├── Count screens matches UI_SPEC
   ├── Each screen content matches spec
   └── All layout classes correct
```

---

## Output Structure

```
prototypes/
├── README.md              # Index + FR mapping
├── styles.css             # Design tokens from UI_SPEC
├── components.css         # Reusable components
├── interactions.js        # CJX animations
├── s01-{screen}.html
├── s02-{screen}.html
└── ...
```

---

## Screen File Template

```html
<!--
  Screen: S-XX {Name from UI_SPEC}
  CJX Stage: {from UI_SPEC}
  FR Mapping: FR-XX
-->
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>{Screen Name}</title>
  <link rel="stylesheet" href="styles.css">
  <link rel="stylesheet" href="components.css">
</head>
<body class="cjx-{stage}">
  <div class="app-layout">
    <nav class="sidebar hide-mobile">...</nav>
    <main class="main-content" data-cjx-entrance>
      <!-- Content matching UI_SPEC exactly -->
    </main>
  </div>
  <script src="interactions.js"></script>
</body>
</html>
```

---

## References (Read as needed)

When implementing specific patterns, read these reference files:

| Pattern | Reference File |
|---------|----------------|
| SVG Charts | `references/chart-examples.md` |
| Layout Classes | `references/layout-patterns.md` |
| CJX Animations | `references/cjx-framework.md` |
| Components | `references/component-standards.md` |

**How to use:**
```
Read .claude/skills/ipa-design/references/chart-examples.md
```

---

## Style Presets (Optional)

| Preset | Description |
|--------|-------------|
| `minimalist` | Clean, whitespace |
| `dashboard` | Data-dense |
| `dark` | Dark theme |

Usage: `/ipa:design dashboard`

---

## Quality Gates

| Check | Requirement |
|-------|-------------|
| Spec Match | Every screen matches UI_SPEC |
| Layout | Uses `app-layout`, `main-content` |
| CJX | Body class + animations |
| Charts | Real SVG, no placeholders |
| Responsive | Mobile breakpoint works |

---

## GATE 3: Design Validation

Before proceeding to `/ipa:detail`:

- [ ] User testing completed with 5+ users
- [ ] Critical issues addressed
- [ ] Design matches MVP scope

**Next:** `/ipa:detail`

---

## Validation Report Template

After generation, output:

```markdown
## Design Generation Report

### Spec Adherence
- UI_SPEC screens: {count}
- Generated screens: {count}
- Match: {yes/no}

### Screens Generated
| Screen | File | CJX Stage | Matches Spec |
|--------|------|-----------|--------------|
| S-01 | s01-xxx.html | cjx-xxx | Yes/No |

### Quality Checks
- [x] All screens match UI_SPEC content
- [x] Layout classes correct
- [x] CJX animations present
- [x] Real SVG charts
```

---

**REMINDER:** This skill implements UI_SPEC exactly. No creative decisions.
