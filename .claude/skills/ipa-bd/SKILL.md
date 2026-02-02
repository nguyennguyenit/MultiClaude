---
name: ipa:bd
description: Generate UI_SPEC.md only (use /ipa:spec for full Stage 1)
user-invocable: true
---

> **💡 TIP:** Use `/ipa:spec` instead to generate both SRD.md + UI_SPEC.md in one step.
>
> This command is kept for granular control when you only need UI_SPEC.md.
>
> **Prerequisite:** `docs/SRD.md` must exist.

---

## Purpose

Generate **Basic Design (外部設計)** following IPA standard with:
- Customer Journey Experience (CJX)
- Design reference support (URL/image)
- Platform-specific UX patterns

Output: `docs/UX_SPEC.md`

---

## Project Type Detection

| Project Type | UX Spec Focus | CJX Adaptation |
|--------------|---------------|----------------|
| **Web App** | Screens, components, responsive | Visual journey |
| **Desktop App** | Windows, dialogs, menus | Productivity journey |
| **CLI Tool** | Commands, output, prompts | Task completion journey |
| **MCP Server** | Tool descriptions, prompts | Developer journey |
| **Chatbot/RAG** | Conversation flows, responses | Query resolution journey |
| **Library/SDK** | API docs, examples | Integration journey |

---

## Input

**Required:**
- `docs/SRD.md`

**Optional:**
- `$ARGUMENTS` = Reference URL or image path for design inspiration
- `docs/tech-stack.md`

---

## User Research Integration

**Before starting UI design, check for USER_RESEARCH.md:**

```
if docs/USER_RESEARCH.md exists:
  1. Read personas and journey maps
  2. Map journey stages to screens
  3. Add "Design Rationale" to each screen
  4. Apply emotional design (CJX)
else:
  Proceed with UI design (without rationale)
```

---

## Output: docs/UI_SPEC.md

```markdown
# UI Specification (Basic Design)

## 1. Customer Journey Experience (CJX)

### User Personas
| Persona | Role | Goals | Pain Points |
|---------|------|-------|-------------|
| P-01 | [Role] | [Goals] | [Pain points] |

### Customer Journey Map

## 2. Design System

### Color Palette
| Name | Hex | RGB | Usage |
|------|-----|-----|-------|
| Primary | #[extracted] | rgb() | Buttons, links, CTAs |

### Typography
| Element | Size | Weight | Line Height |
|---------|------|--------|-------------|
| H1 | 36px / 2.25rem | 700 | 1.2 |

## 3. Screen Specifications

### S-01: [Screen Name]

**Refs:** FR-xx (SRD), CJX Stage: [stage]
**User Goal:** [What user wants to achieve]

**Layout:**
[ASCII diagram]

**Components:**
| Component | Type | States | Action |
|-----------|------|--------|--------|
| [Name] | [Type] | default, hover, focus, disabled | [Action] |
```

---

## Workflow

### With Reference URL:
```
1. WebFetch reference URL
2. Extract design system (colors, fonts, spacing)
3. Use ai-multimodal to analyze screenshots if needed
4. Generate UI_SPEC with extracted values
```

### Without Reference:
```
1. Ask user for color preference or use neutral palette
2. Generate default design system
3. Generate UI_SPEC
```

---

## After Generation

1. Save to `docs/UI_SPEC.md`
2. Ask user to review design system
3. **Next step options:**
   - `/ipa:design [ref]` → Generate HTML mockups
   - `/ipa:dd` → Proceed to Detail Design (API, DB)

**IMPORTANT:** Do not implement code. Only generate documentation.
