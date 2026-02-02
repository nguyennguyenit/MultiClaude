---
description: Extract design specifications from HTML mockups using AI vision
argument-hint: [mockup-directory]
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

Validate:
- At least 1 HTML file found
- Files contain actual mockup content (not empty)

### Step 2: Screenshot Each Mockup

Use Puppeteer or manual screenshots:

**Option A: Automated (Puppeteer)**
```javascript
// Pseudocode - implement via Bash or Node script
for each HTML file:
  1. Open in headless browser
  2. Set viewport to 1920x1080 (desktop)
  3. Screenshot → /tmp/mockup-{N}.png
  4. Set viewport to 375x667 (mobile)
  5. Screenshot → /tmp/mockup-{N}-mobile.png
```

**Option B: Manual**
```
If Puppeteer unavailable:
1. AskUserQuestion: "Please screenshot each mockup file"
2. User provides screenshot paths
3. Continue with analysis
```

### Step 3: AI Vision Analysis

For each screenshot, use `ai-multimodal` skill (Gemini):

**Prompt for AI Vision:**
```
Analyze this UI mockup screenshot and extract:

1. Color Palette:
   - Primary colors (CTAs, links, brand)
   - Secondary colors (accents, highlights)
   - Neutral colors (text, backgrounds, borders)
   - Semantic colors (success, warning, error)
   - For each color, provide hex value

2. Typography:
   - Font families (heading, body, monospace)
   - Font sizes (h1-h6, body, small)
   - Font weights (light, regular, medium, bold)
   - Line heights
   - Letter spacing

3. Spacing System:
   - Padding values (xs, sm, md, lg, xl)
   - Margin values
   - Gap values (flex/grid)
   - Consistent spacing scale (4px, 8px, 16px, etc.)

4. Border & Effects:
   - Border radius values
   - Border widths
   - Box shadows
   - Blur effects (glassmorphism, etc.)

5. Component Patterns:
   - Button styles (primary, secondary, ghost)
   - Input field styles
   - Card styles
   - Modal/dialog styles
   - Table styles
   - Navigation patterns

6. Layout Structure:
   - Grid system (columns, gaps)
   - Container max-widths
   - Sidebar width
   - Header height
   - Footer structure

7. Responsive Behavior:
   - Mobile breakpoint changes
   - Tablet breakpoint changes
   - Desktop-specific elements

Provide measurements in px, and suggest Tailwind CSS equivalents.
```

**Store Response:** Save AI vision analysis to `/tmp/vision-analysis-{N}.json`

### Step 4: HTML/CSS Parsing (Verification)

Parse HTML/CSS to verify AI vision analysis:

```javascript
// Pseudocode
for each HTML file:
  1. Parse <style> tags and linked CSS files
  2. Extract CSS custom properties (--color-*, --font-*, etc.)
  3. Extract Tailwind config (if using <script> tag)
  4. Extract inline styles
  5. Compare with AI vision results
  6. Use exact CSS values where available
```

**Priority:** CSS values > AI vision estimates (CSS is ground truth)

### Step 5: Component Mapping

Map HTML patterns to target tech stack:

**For Each Component:**
1. Identify HTML structure (e.g., `<button class="...">`)
2. Map to tech stack:
   - Astro + React → which shadcn/ui component?
   - Tailwind CSS → which utility classes?
   - Custom component needed?

**Example Mapping:**
```
HTML: <button class="glass-panel rounded-3xl px-8 py-4 bg-gradient-to-br from-blue-600">
  ↓
shadcn/ui: <Button variant="default" />
Tailwind: className="backdrop-blur-lg bg-white/80 rounded-3xl px-8 py-4 bg-gradient-to-br from-blue-600 to-blue-400"
```

### Step 6: Generate UI_DESIGN_SPEC.md

Write `docs/UI_DESIGN_SPEC.md`:

**Template:**
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
| primary | #2563EB | blue-600 | Primary CTA, links | 01-login-screen.html line 12 |
| secondary | #3B82F6 | blue-500 | Secondary actions | 01-login-screen.html line 18 |
| dark | #0F172A | slate-900 | Text, backgrounds | 02-dashboard.html line 45 |

**Tailwind Config:**
```js
// Add to tailwind.config.mjs
colors: {
  primary: '#2563EB',
  secondary: '#3B82F6',
  dark: '#0F172A',
  // ... all extracted colors
}
```

### Typography

| Element | Font | Size | Weight | Line Height | Tailwind | Mockup Source |
|---------|------|------|--------|-------------|----------|---------------|
| H1 | Outfit | 48px | 700 | 1.2 | text-5xl font-bold font-heading | 01-login.html line 25 |
| H2 | Outfit | 32px | 600 | 1.3 | text-3xl font-semibold font-heading | 02-dash.html line 67 |
| Body | Work Sans | 16px | 400 | 1.5 | text-base | Global |

**Tailwind Config:**
```js
// Add to tailwind.config.mjs
fontFamily: {
  sans: ['Work Sans', 'sans-serif'],
  heading: ['Outfit', 'sans-serif'],
}
```

### Spacing System

| Token | Value | Tailwind | Usage | Mockup Source |
|-------|-------|----------|-------|---------------|
| xs | 4px | space-1 / p-1 | Icon gaps | Multiple |
| sm | 8px | space-2 / p-2 | Component padding | Multiple |
| md | 16px | space-4 / p-4 | Card padding | Card components |
| lg | 32px | space-8 / p-8 | Section spacing | Layout |
| xl | 48px | space-12 / p-12 | Page margins | Login page |

### Effects

| Property | Value | Tailwind | Usage | Mockup Source |
|----------|-------|----------|-------|---------------|
| Border Radius | 12px | rounded-xl | Cards, buttons | Multiple |
| Border Radius (Large) | 24px | rounded-3xl | Modals | 04-create-project-modal.html |
| Shadow | 0 4px 6px rgba(0,0,0,0.1) | shadow-md | Elevated elements | Multiple |
| Blur | backdrop-blur(16px) | backdrop-blur-lg | Glass panels | 01-login.html |

---

## Component Mapping

### 01-login-screen.html

**HTML Structure:**
```html
<div class="glass-panel rounded-3xl p-12">
  <div class="w-10 h-10 bg-gradient-to-br from-blue-600 to-blue-400 rounded-xl">
    <!-- Logo -->
  </div>
  <h1 class="text-5xl font-bold font-heading">Connect Your World</h1>
  <form>
    <input type="email" class="...">
    <input type="password" class="...">
    <button class="bg-gradient-to-br from-blue-600 to-blue-400">Login</button>
  </form>
</div>
```

**Tech Stack Implementation (Astro + React + Tailwind + shadcn/ui):**

*Astro Page:*
```astro
// src/pages/login.astro
---
import LoginForm from '@/components/LoginForm';
---
<html>
  <body class="h-screen flex items-center justify-center">
    <LoginForm client:load />
  </body>
</html>
```

*React Component:*
```tsx
// src/components/LoginForm.tsx
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

export default function LoginForm() {
  return (
    <div className="backdrop-blur-lg bg-white/80 rounded-3xl p-12 max-w-md">
      <div className="w-10 h-10 bg-gradient-to-br from-blue-600 to-blue-400 rounded-xl flex items-center justify-center">
        {/* Logo icon */}
      </div>
      <h1 className="text-5xl font-bold font-heading text-slate-900 mt-8">
        Connect Your World
      </h1>
      <form className="mt-8 space-y-4">
        <Input
          type="email"
          placeholder="Email"
          className="..." // From mockup styles
        />
        <Input
          type="password"
          placeholder="Password"
          className="..." // From mockup styles
        />
        <Button className="w-full bg-gradient-to-br from-blue-600 to-blue-400">
          Login
        </Button>
      </form>
    </div>
  );
}
```

**Component Checklist:**
- [ ] Use shadcn/ui Input component
- [ ] Use shadcn/ui Button component
- [ ] Apply exact colors from design tokens
- [ ] Apply exact spacing (p-12, mt-8, space-y-4)
- [ ] Apply exact typography (text-5xl font-bold font-heading)
- [ ] Apply glassmorphism effect (backdrop-blur-lg bg-white/80)
- [ ] Ensure responsive (max-w-md, padding adjustments on mobile)

---

[Repeat for each screen: 02-dashboard.html, 03-projects-list.html, etc.]

---

## Responsive Breakpoints

| Screen | Breakpoint | Layout Changes | Mockup Evidence |
|--------|------------|----------------|-----------------|
| Mobile | < 768px | Sidebar collapses to hamburger, cards stack, tables scroll | Tested on 375px viewport |
| Tablet | 768px - 1024px | Sidebar visible, 2-column grid, tables full width | Tested on 768px viewport |
| Desktop | > 1024px | Full layout, 3-4 column grid, all features visible | Default 1920px viewport |

**Tailwind Responsive Classes:**
```tsx
// Mobile-first approach
<div className="p-4 md:p-8 lg:p-12"> {/* Padding increases with screen size */}
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3"> {/* Responsive grid */}
<div className="hidden md:block"> {/* Show only on tablet+ */}
```

---

## API Integration Map

| Screen | Component | BE Endpoint | Data Model | Mockup Ref |
|--------|-----------|-------------|------------|------------|
| Login | LoginForm | POST /api/v1/auth/login | { email, password } → { token, user } | 01-login.html |
| Dashboard | DashboardStats | GET /api/v1/stats/dashboard | { totalProjects, totalMemories, storageUsed } | 02-dashboard.html |
| Projects List | ProjectsTable | GET /api/v1/projects | { projects: Project[], total: number } | 03-projects-list.html |

**Cross-Reference:** See `docs/API_SPEC.md` for full endpoint specifications

---

## Quality Checklist

**Before considering UI_DESIGN_SPEC.md complete:**

Design Tokens:
- [ ] All colors extracted (primary, secondary, neutrals, semantics)
- [ ] All fonts identified (family, sizes, weights)
- [ ] Spacing system consistent (4px/8px scale or custom)
- [ ] Effects documented (shadows, borders, blur)

Component Mapping:
- [ ] Each mockup screen has component breakdown
- [ ] HTML → Tech stack mapping clear
- [ ] shadcn/ui components identified
- [ ] Tailwind classes specified

Responsive:
- [ ] Mobile breakpoint behavior defined
- [ ] Tablet breakpoint behavior defined
- [ ] Desktop breakpoint behavior defined

Integration:
- [ ] API endpoints mapped to components
- [ ] Data models cross-referenced with API_SPEC.md

Accuracy:
- [ ] CSS values verified against HTML files
- [ ] AI vision results validated against source
- [ ] No guesswork - all values traceable to mockup source

---

## Usage in /plan Tasks

**Before Enhancement (Vague):**
```markdown
### Task 3.1: Implement Login Page
- [ ] Match mockup styling   ❌ HOW?
```

**After Enhancement (100% Specific):**
```markdown
### Task 3.1: Implement Login Page

**Refs:**
- 📋 Mockup: docs/UI-new-mock/01-login-screen.html
- 📋 Design Spec: docs/UI_DESIGN_SPEC.md#01-login-screen
- 📋 API: docs/API_SPEC.md#auth-login

**Files:**
- `apps/FE/src/pages/login.astro`
- `apps/FE/src/components/LoginForm.tsx`

**Implementation (from UI_DESIGN_SPEC.md):**
1. Container: `backdrop-blur-lg bg-white/80 rounded-3xl p-12 max-w-md`
2. Logo: 40px circle, gradient blue-600 to blue-400, rounded-xl
3. Heading: `text-5xl font-bold font-heading text-slate-900`
4. Form fields:
   - Email: shadcn/ui Input component
   - Password: shadcn/ui Input with eye toggle
5. Button: `bg-gradient-to-br from-blue-600 to-blue-400 w-full`
6. Responsive:
   - Mobile (< 768px): `p-6` instead of `p-12`
   - Desktop: Full glassmorphism with background shapes

**Acceptance:**
- [ ] Visual diff: Screenshot matches mockup 100%
- [ ] Colors exact match (primary: #2563EB, dark: #0F172A)
- [ ] Fonts exact match (Outfit for headings, Work Sans for body)
- [ ] Spacing exact match (p-12 desktop, p-6 mobile)
- [ ] Responsive behavior matches all breakpoints
- [ ] API integration works (POST /api/v1/auth/login)
```

---
```

---

## Error Handling

### Common Failure Scenarios

**No HTML files found:**
- Check mockup directory path is correct
- Use AskUserQuestion to get correct path from user
- Verify files have .html extension
- Fallback: Ask user to provide file paths manually

**Puppeteer/Screenshot tool unavailable:**
- Attempt to use system screenshot tool (macOS: screencapture, Linux: scrot)
- Fallback to manual screenshot workflow
- Use AskUserQuestion: "Please screenshot each mockup file and provide paths"
- Continue with manual screenshots

**AI vision API failure:**
- Retry 3 times with exponential backoff (1s, 2s, 4s)
- Check API key and rate limits
- Fallback to CSS-only parsing (skip AI vision step)
- Log warning: "AI vision unavailable, using CSS parsing only"
- Continue with reduced accuracy (CSS values only)

**HTML/CSS parsing errors:**
- Skip malformed files, log warning
- Continue with successfully parsed files
- Report parsing errors to user
- Suggest manual review of problematic files

**Conflicting values (AI vision vs CSS):**
- **Priority:** CSS values win (ground truth)
- Log conflicts for user review
- Include both values in UI_DESIGN_SPEC.md with note:
  ```markdown
  | primary | #2563EB | blue-600 | Primary CTA | 01-login.html line 12 |
  <!-- AI vision suggested #2564EB, using CSS value #2563EB -->
  ```

**Empty or incomplete mockups:**
- Warn user about missing content
- Generate partial spec with available data
- Mark incomplete sections with TODO comments
- Suggest completing mockups before implementation

### Error Recovery Strategy

```
1. Attempt primary method (AI vision + CSS parsing)
2. If AI vision fails → Retry 3x → Fallback to CSS-only
3. If CSS parsing fails → Skip file, continue with others
4. If no files processable → Ask user for help
5. Always generate spec with available data (partial OK)
```

### Validation on Output

Before writing UI_DESIGN_SPEC.md, validate:
- At least 1 color extracted
- At least 1 font identified
- At least 1 spacing value found
- At least 1 component mapped

If validation fails:
- Report to user: "Insufficient data extracted"
- Show what was found
- Ask user to verify mockup quality or provide additional mockups

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
