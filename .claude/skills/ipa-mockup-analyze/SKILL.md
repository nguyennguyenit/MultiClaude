---
name: ipa:mockup-analyze
description: Extract design specifications from HTML mockups using AI vision
user-invocable: true
argument-hint: "[mockup-directory]"
---

## Purpose

Generate **UI_DESIGN_SPEC.md** from HTML mockups using AI vision (Gemini) + HTML/CSS parsing.

Output: `docs/UI_DESIGN_SPEC.md` (design tokens, component mapping, responsive specs)

---

## Input

<mockup-dir>
$ARGUMENTS
</mockup-dir>

Default: `docs/UI-new-mock/` or `docs/prototypes/`

---

## Role

You are a **UI/UX Specification Engineer** who:
- Analyzes visual designs with pixel-perfect precision
- Extracts design tokens (colors, typography, spacing, effects)
- Maps HTML/CSS patterns to modern tech stacks
- Ensures 100% implementation accuracy

---

## Workflow

### Step 1: Discover Mockup Files

```bash
# Find all HTML files in mockup directory
find <mockup-dir> -name "*.html" -type f
```

### Step 2: Screenshot Each Mockup

Use Puppeteer or manual screenshots for each HTML file.

### Step 3: AI Vision Analysis

For each screenshot, use `ai-multimodal` skill (Gemini) to extract:
1. Color Palette (hex values)
2. Typography (fonts, sizes, weights)
3. Spacing System (padding, margin, gap)
4. Border & Effects (radius, shadows, blur)
5. Component Patterns (buttons, inputs, cards)
6. Layout Structure (grid, container widths)
7. Responsive Behavior (breakpoint changes)

### Step 4: HTML/CSS Parsing (Verification)

Parse HTML/CSS to verify AI vision analysis:
- Extract CSS custom properties (--color-*, --font-*, etc.)
- Extract Tailwind config (if using <script> tag)
- **Priority:** CSS values > AI vision estimates (CSS is ground truth)

### Step 5: Component Mapping

Map HTML patterns to target tech stack:
- Which shadcn/ui component?
- Which Tailwind CSS utilities?
- Custom component needed?

### Step 6: Generate UI_DESIGN_SPEC.md

Write `docs/UI_DESIGN_SPEC.md` with:
- Design Tokens (colors, typography, spacing, effects)
- Component Mapping (HTML → Tech stack)
- Responsive Breakpoints
- API Integration Map

---

## Output Template

```markdown
# UI Design Specification

**Generated:** {date}
**Source:** {mockup-directory}
**Screens Analyzed:** {count}

---

## Design Tokens

### Colors

| Token | Hex | Tailwind | Usage | Mockup Source |
|-------|-----|----------|-------|---------------|
| primary | #2563EB | blue-600 | Primary CTA, links | 01-login.html line 12 |

### Typography

| Element | Font | Size | Weight | Line Height | Tailwind | Mockup Source |
|---------|------|------|--------|-------------|----------|---------------|
| H1 | Outfit | 48px | 700 | 1.2 | text-5xl font-bold | 01-login.html line 25 |

### Spacing System

| Token | Value | Tailwind | Usage |
|-------|-------|----------|-------|
| md | 16px | space-4 / p-4 | Card padding |

---

## Component Mapping

### 01-login-screen.html

**HTML Structure:**
[Extracted HTML]

**Tech Stack Implementation:**
[Framework-specific code]

---

## Quality Checklist

- [ ] All colors extracted
- [ ] All fonts identified
- [ ] Spacing system consistent
- [ ] Components mapped
- [ ] Responsive tested
```

---

## Dependencies

- `ai-multimodal` skill (for AI vision analysis)
- Puppeteer OR manual screenshot workflow

---

## Notes

- This command creates workflow documentation, not code
- AI vision provides visual pattern extraction
- HTML/CSS parsing provides exact values (ground truth)
- Hybrid approach ensures 100% accuracy
- Output serves as single source of truth for UI implementation
