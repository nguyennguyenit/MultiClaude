# Design Analysis Workflow

## Overview

Hybrid analysis of design mockups: visual capture via ai-multimodal + code structure parsing.

## Triggers

Activated when context-parsing detects:
- HTML/CSS/JS files in @path references
- `has_design: true` in context object

## Analysis Pipeline

### Step 1: Visual Capture

Use `ai-multimodal` skill to screenshot and analyze each HTML file.

**Prompt template:**
```
Analyze this HTML mockup design. Extract:

1. LAYOUT: Visual hierarchy, grid structure, sections
2. COLORS: Primary, secondary, accent, background, text colors (hex values)
3. TYPOGRAPHY: Font families, sizes, weights for headings/body
4. SPACING: Margin/padding patterns, consistent spacing units
5. COMPONENTS: Buttons, inputs, cards, modals, navigation elements
6. STATES: Hover, active, disabled, error states visible
7. RESPONSIVE: Any visible breakpoint indicators
8. NAVIGATION: All links, buttons with onclick, form actions → extract destinations
```

**Viewport sizes:**
- Desktop: 1440px width
- Tablet: 768px width (optional)
- Mobile: 375px width (optional)

### Step 2: HTML Structure Parsing

Read HTML files and extract:

```
Structure analysis:
- Semantic elements: header, main, footer, nav, aside, section
- Component hierarchy: nested structure, naming patterns
- Class names: potential component/utility names
- IDs: unique identifiers for key elements
- Data attributes: data-* hints for functionality
- Forms: input types, labels, validation attributes
- Links: href values → navigation destinations
- Buttons: onclick handlers → navigation or actions
- Form actions: form action attributes → API endpoints
```

### Step 3: Navigation Flow Extraction

**CRITICAL: Extract all navigation from mockup**

Parse HTML for:
```
1. <a href="..."> → Link destinations
2. onclick="window.location.href='...'" → JavaScript navigations
3. <form action="..."> → Form submissions
4. <button> with data-* attributes → Modal/action triggers
```

Build navigation map:
```yaml
navigation_flow:
  - element: "Sign In button"
    trigger: "click"
    destination: "/dashboard"
    source_file: "01-login-screen.html"
    target_file: "02-dashboard-home.html"
    condition: "Login success"

  - element: "Projects nav item"
    trigger: "click"
    destination: "/projects"
    source_file: "02-dashboard-home.html"
    target_file: "03-projects-list.html"
```

### Step 4: CSS Analysis

Read CSS files and extract:

```
Style analysis:
- Custom properties: --color-*, --font-*, --spacing-*
- Color values: all hex/rgb/hsl values → build palette
- Font stacks: font-family declarations
- Sizing: font-size, width, height patterns
- Spacing: margin, padding values → identify system
- Media queries: breakpoint values
- Animations: transition, animation definitions
- Pseudo-classes: :hover, :focus, :active styles
```

### Step 4: JavaScript Analysis (if present)

Read JS files and extract:

```
Behavior analysis:
- Event listeners: click, submit, change handlers
- DOM manipulation: element creation, class toggling
- Form handling: validation, submission logic
- State patterns: show/hide, toggle, accordion
- API hints: fetch calls, endpoints referenced
```

## Output: Design Analysis Report

Generate `design-analysis-report.md`:

```markdown
# Design Analysis Report

Generated: {date}
Source: {source_path}

## Visual Overview

[Reference screenshots captured via ai-multimodal]

## Component Inventory

| Component | Count | Selector | Notes |
|-----------|-------|----------|-------|
| Primary Button | 2 | `.btn-primary` | Blue bg, white text, rounded |
| Text Input | 4 | `.form-input` | Border, placeholder, focus ring |
| Card | 3 | `.card` | Shadow, padding, rounded corners |
| Modal | 1 | `.modal` | Overlay, centered, close button |

## Color Palette

| Name | Value | CSS Variable | Usage |
|------|-------|--------------|-------|
| Primary | #3B82F6 | `--color-primary` | Buttons, links, accents |
| Secondary | #6B7280 | `--color-secondary` | Muted text, borders |
| Background | #F9FAFB | `--color-bg` | Page background |
| Surface | #FFFFFF | `--color-surface` | Cards, modals |
| Text | #111827 | `--color-text` | Body text |
| Error | #EF4444 | `--color-error` | Validation errors |

## Typography

| Element | Font | Size | Weight | Line Height |
|---------|------|------|--------|-------------|
| H1 | Inter | 2.5rem | 700 | 1.2 |
| H2 | Inter | 2rem | 600 | 1.3 |
| Body | Inter | 1rem | 400 | 1.5 |
| Small | Inter | 0.875rem | 400 | 1.4 |

## Spacing System

Base unit: 4px

| Token | Value | Usage |
|-------|-------|-------|
| xs | 4px | Icon gaps |
| sm | 8px | Inline spacing |
| md | 16px | Component padding |
| lg | 24px | Section gaps |
| xl | 32px | Container padding |

## Breakpoints

| Name | Width | Notes |
|------|-------|-------|
| Mobile | < 640px | Single column |
| Tablet | 640-1024px | Two column |
| Desktop | > 1024px | Full layout |

## Interactive Elements

| Element | Trigger | Behavior |
|---------|---------|----------|
| Submit button | click | Form validation + submit |
| Password field | focus | Show/hide toggle appears |
| Form inputs | blur | Validation feedback |
| Modal close | click | Fade out + remove |

## Navigation Map

| Source Screen | Element | Destination | Route |
|---------------|---------|-------------|-------|
| 01-login | Sign In button | Dashboard | `/dashboard` |
| 02-dashboard | Projects nav | Projects List | `/projects` |
| 02-dashboard | New Project btn | Create Modal | Modal overlay |
| 03-projects | Project card | Project Detail | `/projects/:id` |
| ... | ... | ... | ... |

## Implementation Notes

- Layout: CSS Grid for main structure, Flexbox for components
- Icons: [identify icon library if visible]
- Animations: subtle transitions (0.2s ease)
- Accessibility: ensure focus states, ARIA labels

## Recommendations

1. [Specific implementation suggestions based on analysis]
2. [Framework-specific notes if target known]
3. [Potential challenges or considerations]
```

## Tech Stack Adaptation

After extracting design code, apply transformations based on detected tech stack.
Load: `references/tech-stack-adaptation.md`

### Include in Report

```markdown
## Tech Stack Adaptation

**Target Framework:** [Detected from .claude/tech-stack.md]

| Aspect | Value |
|--------|-------|
| Class Attribute | `className` or `class` |
| Icon Library | `lucide-react` / `lucide-vue-next` / etc. |
| Component Extension | `.tsx` / `.vue` / `.svelte` / etc. |
| Routing Pattern | Framework-specific path |

### Transformed Components

[For each component, show stack-specific code]
```

### Full Content Extraction (CRITICAL)

When extracting from mockup HTML, capture EVERYTHING:

1. **Exact text content** - titles, labels, descriptions, placeholders
2. **Exact class names** - every Tailwind/CSS class
3. **Icon names** - data-lucide attributes → convert to imports
4. **SVG paths** - full path data for custom icons
5. **CSS definitions** - custom classes from stylesheets
6. **Navigation** - all href, onclick, form actions
7. **Config** - Tailwind config if inline

Output should be copy-paste ready for implementation.

## File Operations

### Copy Design Files

```bash
# Create design directory in plan folder
mkdir -p {plan-dir}/design

# Copy from source preserving structure
cp -r {source-path}/* {plan-dir}/design/
```

### Save Report

Location: `{plan-dir}/reports/design-analysis-report.md`

## Fallback: Code-Only Mode

If `ai-multimodal` unavailable:

1. Skip visual capture step
2. Rely on HTML/CSS/JS parsing only
3. Note in report: "Visual analysis unavailable, code-only extraction"
4. Still generate component inventory from code

## Integration with Planning

After analysis complete:

1. Add design context to planner prompt
2. Reference report in phase files
3. Map components → implementation tasks
4. Include design specs in acceptance criteria:
   ```
   - [ ] Button uses primary color #3B82F6
   - [ ] Input has focus ring matching design
   - [ ] Spacing follows 4px base unit
   ```

---

## Phase File Structure for 100% Design Match

**CRITICAL**: Each phase file must contain COMPLETE code snippets that enable `/code` to produce output matching design 100%.

### Required Phase Sections

```markdown
# Phase XX: [Screen Name]

## Tech Stack Adaptation
**Detected:** [Framework] (from .claude/tech-stack.md)

## Design Analysis (from mockup)
### Layout
[ASCII diagram showing screen structure]

### Tailwind Config (REQUIRED)
```js
tailwind.config = { ... }
```

### CSS Classes (REQUIRED)
```css
[ALL custom CSS classes from stylesheets]
```

## Full Content Extraction
### Background Decorations
```tsx
[EXACT code for blurs, gradients, shapes]
```

### Component Name
```tsx
[EXACT JSX/TSX/Vue/etc. with full className, text, icons]
```

### SVG Icons
```tsx
[COMPLETE SVG path data for custom icons]
```

## Navigation Flow
| Trigger | Action | Destination |
|---------|--------|-------------|
| ... | ... | ... |

## Implementation Tasks
### UI Tasks
| # | Task | Component | Details |
|---|------|-----------|---------|
| UI-1 | ... | ... | ... |

### API Tasks
| # | Endpoint | Method | Request | Response |
|---|----------|--------|---------|----------|

### Core Logic Tasks
| # | Task | File | Description |
|---|------|------|-------------|

## Acceptance Criteria
### Visual (100% match)
- [ ] Every element from design present
- [ ] All text exact (titles, labels, placeholders)
- [ ] All colors from Tailwind/CSS config
- [ ] All SVG paths complete
- [ ] All animations/transitions included

### Functional
- [ ] Form validation working
- [ ] API calls connected
- [ ] Redirects functional
```

### Code Snippet Quality Rules

**WRONG** (incomplete, will NOT produce 100% match):
```tsx
// Wrong: Generic description
<button>Submit</button>

// Wrong: Missing details
<div className="glass-panel">
  <h2>Welcome</h2>
</div>
```

**CORRECT** (complete, copy-paste ready):
```tsx
// Correct: Full implementation with exact values
<button
  type="submit"
  className="btn-primary w-full py-3.5 rounded-xl text-white font-semibold text-lg shadow-lg shadow-blue-500/30 flex items-center justify-center gap-2 group hover:bg-blue-700 transition-all"
>
  Sign In
  <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
</button>

// Correct: Every className, every text, every attribute
<div className="glass-panel relative overflow-hidden bg-gradient-to-br from-white/90 to-white/70 backdrop-blur-xl border border-white/60 shadow-2xl rounded-3xl p-12">
  <div className="flex items-center gap-3 mb-8">
    <div className="w-10 h-10 bg-gradient-to-br from-blue-600 to-blue-400 rounded-xl flex items-center justify-center shadow-lg shadow-blue-500/20">
      <BrainCircuit className="text-white w-6 h-6" />
    </div>
    <span className="text-2xl font-bold font-heading text-slate-800">AppName</span>
  </div>
</div>
```

### Extraction Checklist

When generating phase content, ensure:

- [ ] **Tailwind Config**: All colors, fonts, spacing from mockup
- [ ] **CSS Classes**: All custom classes (glass-panel, btn-primary, etc.) with full definitions
- [ ] **Background Elements**: Blurs, gradients, shapes with exact sizes/positions
- [ ] **Text Content**: Every title, label, description, placeholder exactly as in mockup
- [ ] **Class Names**: Complete className string (no "...", no "etc.")
- [ ] **Icons**: Full import + exact Lucide icon names OR complete SVG paths
- [ ] **Navigation**: All href, onclick, form actions → router.push/table actions
- [ ] **Animations**: All transition, animation, hover states
- [ ] **Responsive**: Breakpoint indicators if visible in mockup
