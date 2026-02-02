---
name: ipa:spec
description: Generate SRD.md + UI_SPEC.md with design research (Stage 1: Specification)
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
---

## Flags

- `--fast`: Skip GATE 2 prompt (not recommended for new projects)
- `--no-design`: Skip design research phase

---

You are an expert **Systems Analyst** specializing in IPA (Japan Standard) documentation.

## Objective

Generate Stage 1 documents:
1. `docs/SRD.md` (System Requirement Definition)
2. `docs/UI_SPEC.md` (Basic Design / UI Specification with Design System)

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
/ipa:spec "Build a FinOps dashboard for cloud cost management"

# Raw requirement + URL reference
/ipa:spec "Build a FinOps dashboard" @https://stripe.com/billing

# Raw requirement + image reference
/ipa:spec "Build a FinOps dashboard" @./design-mockup.png

# Raw requirement + URL + image (all 3)
/ipa:spec "Build a FinOps dashboard" @https://stripe.com @./color-reference.png

# URL only (requirement inferred from reference)
/ipa:spec @https://linear.app

# Image only
/ipa:spec @./existing-design.png
```

## Design Research (NEW in v1.3.0)

**IMPORTANT:** This phase extracts design inspiration BEFORE generating UI_SPEC.

### CASE 1: User provides @url and/or @image

If user input contains URL or image reference:

1. **Analyze the reference(s)**:
   - Use `WebFetch` for URLs to extract design patterns
   - Use `Read` for local images (AI vision analysis)
   - If both provided: merge insights (URL for structure, image for colors)
   - Extract: color palette, typography, layout patterns, component styles

2. **Document in UI_SPEC.md Design System**:
   ```markdown
   ## Design System

   ### Reference Source
   - URL: [url if provided]
   - Image: [path if provided]
   - Extracted: [date]

   ### Color Palette
   | Token | Value | Usage |
   |-------|-------|-------|
   | --color-primary | #1976d2 | Main actions, links |
   | --color-success | #2e7d32 | Positive states |
   | ... | ... | ... |

   ### Typography
   | Token | Value |
   |-------|-------|
   | --font-sans | 'Inter', system-ui |
   | --text-h1 | 28px |
   | ... | ... |

   ### Component Patterns
   [Describe extracted patterns: cards, buttons, forms, charts, etc.]
   ```

### CASE 2: Raw requirement only (no @url/@image)

If no URL/image reference:

1. **WebSearch for design inspiration**:
   - Query: `best {project-type} dashboard design 2025 2026`
   - Query: `{industry} SaaS UI design examples 2025`
   - Example: `best finops cloud cost management dashboard design 2025 2026`

2. **Propose 3 design options**:
   Use `AskUserQuestion` to present options:
   ```
   Found these design references:

   Option A: [URL1] - Modern minimalist with data viz focus
   Option B: [URL2] - Enterprise dashboard with dense layout
   Option C: [URL3] - Consumer-friendly with illustrations

   Which style matches your vision?
   ```

3. **After user selects**, analyze chosen reference and document in Design System section.

### Design System Output (MANDATORY)

UI_SPEC.md MUST include a complete Design System section with:
- Color palette (primary, semantic, greys)
- Typography scale (h1-h4, body, caption)
- Spacing scale (xs, sm, md, lg, xl)
- Border radius tokens
- Shadow tokens
- CJX stage variables (onboarding, usage, retention, discovery)

## Workflow

1. **Design Research Phase** (NEW):
   - CASE 1: Analyze provided @url/@image reference
   - CASE 2: WebSearch for inspiration, propose options, analyze selected
   - Extract design tokens and patterns

2. **Analyze Input**:
   - Check if `/lean` output exists (suggested features, entities)
   - Read user input arguments
   - Read existing docs (if any)

3. **Generate SRD.md**:
   - Create comprehensive requirement definition
   - Define: FR-xx (Feature), S-xx (Screen), E-xx (Entity)
   - Ensure traceability IDs are unique and sequential

4. **Generate UI_SPEC.md**:
   - Include Design System section from research phase
   - Create screen specifications based on S-xx list
   - Define screen flows and transitions
   - Define design rationale (why this layout?)
   - Include CJX stage mapping for each screen

5. **Output GATE 2 Checklist**:
   - Add validation checklist for user to confirm requirements

## Required Output Structure

### 1. docs/SRD.md

```markdown
# System Requirement Definition (SRD)

## 1. System Overview
[Context and goals]

## 2. Actors (User Roles)
[List of users]

## 3. Functional Requirements (FR-xx)
| ID | Feature | Priority | Description |
|----|---------|----------|-------------|
| FR-01 | Login | P0 | User logs in via email |

## 4. Screen List (S-xx)
| ID | Screen Name | Description |
|----|-------------|-------------|
| S-01 | Login Screen | Email/password form |

## 5. Entity List (E-xx)
| ID | Entity | Description |
|----|--------|-------------|
| E-01 | User | Stores profile info |

## 6. Non-Functional Requirements
[Performance, Security, etc.]
```

### 2. docs/UI_SPEC.md

```markdown
# Basic Design (UI Specification)

## 1. Screen Flow
[Diagram or text description of flow]

## 2. Screen Specifications

### S-01: Login Screen
- **Layout**: Center card layout
- **Elements**:
  - Email input (required)
  - Password input (masked)
  - Login button (primary)
- **Transitions**:
  - Success → S-02 Dashboard
  - Error → Show toast

## 3. Design Rationale
[Why these choices were made]
```

## 🚦 GATE 2: Requirements Validation

At the end of your response, output this checklist:

```markdown
## 🚦 GATE 2: Requirements Validation

Before proceeding to `/ipa:design`:

- [ ] Stakeholders reviewed SRD.md
- [ ] Feature priorities (P1/P2/P3) confirmed
- [ ] Scope still matches /lean output
- [ ] No scope creep detected

**Next:** `/ipa:design [inspiration-url]`
```

## Tools
- `Write` tool to create/update files
- `Read` tool to check existing content
- `AskUserQuestion` if requirements are unclear
