---
description: Generate UI prototypes from UI_SPEC with CJX-driven design decisions
argument-hint: [reference-url or image-path]
---

## Purpose

Generate **production-ready HTML/CSS/JS prototypes** from `docs/UI_SPEC.md`.

**Key Features:**
- CJX-driven design (emotions → UI decisions)
- Reference cloning (URL/image)
- UI/UX Pro Max skill integration

Output: `docs/prototypes/` (HTML, CSS, JS, icons)

---

## Input

**Required:**
- `docs/UI_SPEC.md` (must exist from /ipa:bd, includes CJX)

**Optional Reference:**
<reference>
$ARGUMENTS
</reference>

Reference can be:
- **URL**: Website to clone design from (e.g., `https://example.com`)
- **Image**: Screenshot or design file path (e.g., `./design.png`)
- **Style**: Preset name (e.g., `minimalist`, `glassmorphism`)

---

## CJX → Design Mapping

Read CJX from UI_SPEC.md and apply to design decisions:

```
┌─────────────────────────────────────────────────────────────┐
│ CJX-DRIVEN DESIGN                                           │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│ JOURNEY STAGE → DESIGN PATTERN                              │
│                                                             │
│ Discovery (Curious)                                         │
│   → Bold hero, trust signals, clear value prop              │
│   → Primary CTA prominent, social proof visible             │
│   → Animation: subtle entrance, draw attention              │
│                                                             │
│ Onboarding (Hesitant)                                       │
│   → Progress indicator, minimal fields                      │
│   → Reassuring copy, easy exit option                       │
│   → Animation: encouraging micro-interactions               │
│                                                             │
│ Usage (Engaged)                                             │
│   → Clean dashboard, quick actions                          │
│   → Data visualization, status feedback                     │
│   → Animation: smooth transitions, success celebrations     │
│                                                             │
│ Retention (Satisfied/Frustrated)                            │
│   → Help accessible, feedback channels                      │
│   → Achievement badges, usage stats                         │
│   → Animation: reward animations, gentle nudges             │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### Emotion → Visual Mapping

| User Emotion | Color Tone | Typography | Spacing | Animation |
|--------------|------------|------------|---------|-----------|
| Curious | Vibrant, inviting | Bold headlines | Generous | Entrance effects |
| Hesitant | Calm, trustworthy | Clear, readable | Comfortable | Subtle guides |
| Confused | Simple, focused | Large, clear | Lots of whitespace | Directional cues |
| Frustrated | Neutral, calming | Easy to scan | Minimal clutter | Soothing transitions |
| Satisfied | Warm, celebratory | Friendly | Balanced | Success feedback |
| Engaged | Energetic, focused | Efficient | Compact but clear | Quick responses |

---

## Skill Activation

This command activates the **ui-ux-promax** skill with VividKit principles.

### Design Intelligence (from VividKit)

```
┌─────────────────────────────────────────────────────────────┐
│ AI DESIGN DATABASE (50+ Styles, 21+ Palettes, 50+ Fonts)   │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│ 1. ANALYZE INPUT                                            │
│    - Read docs/UI_SPEC.md (screens, design system)          │
│    - Analyze reference URL/image (if provided)              │
│    - Extract: colors, typography, spacing, patterns         │
│                                                             │
│ 2. MATCH DESIGN PATTERNS                                    │
│    - Industry context (SaaS, E-commerce, Dashboard, etc.)   │
│    - UI style (minimalist, glassmorphism, etc.)             │
│    - Component library (cards, forms, navigation)           │
│                                                             │
│ 3. GENERATE PRODUCTION CODE                                 │
│    - HTML5 semantic structure                               │
│    - CSS with design tokens                                 │
│    - Responsive breakpoints                                 │
│    - Interaction states                                     │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## Complete Design Workflow

```
┌─────────────────────────────────────────────────────────────┐
│ /ipa:design [reference]                                     │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│ STEP 1: Read UI_SPEC.md                                     │
│   ├── CJX: Personas, Journey Map, Touchpoints              │
│   ├── Design System: Colors, Typography, Spacing           │
│   └── Screens: Layout, Components, States                  │
│                                                             │
│ STEP 2: Analyze Reference (if provided)                     │
│   ├── URL → WebFetch + Screenshot → Extract tokens         │
│   └── Image → ai-multimodal → Extract visual patterns      │
│                                                             │
│ STEP 3: CJX → Design Decisions                              │
│   ├── Map screens to journey stages                         │
│   ├── Apply emotion-based styling                           │
│   └── Add appropriate micro-interactions                    │
│                                                             │
│ STEP 4: Generate Prototypes                                 │
│   ├── styles.css (design system + CJX variables)           │
│   ├── components.css (reusable patterns)                   │
│   ├── interactions.js (CJX-driven animations)              │
│   └── s{N}-{screen}.html (per screen)                      │
│                                                             │
│ STEP 5: Validate Quality                                    │
│   ├── CJX alignment check                                   │
│   ├── Accessibility (WCAG AA)                               │
│   └── Responsive breakpoints                                │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## Design Clone Workflow

### With Reference URL

```
/ipa:design https://stripe.com/billing
         ↓
┌─────────────────────────────────────────┐
│ 1. WebFetch + Screenshot reference      │
│ 2. Extract design tokens:               │
│    - Color palette                      │
│    - Typography (font-family, sizes)    │
│    - Spacing rhythm                     │
│    - Component styles                   │
│    - Layout patterns                    │
│ 3. Merge with CJX requirements          │
│ 4. Generate HTML/CSS/JS prototypes      │
└─────────────────────────────────────────┘
```

### With Reference Image

```
/ipa:design ./inspiration.png
         ↓
┌─────────────────────────────────────────┐
│ 1. ai-multimodal skill analyzes image   │
│ 2. Extract:                             │
│    - Dominant colors → palette          │
│    - Font appearance → similar fonts    │
│    - Layout structure → grid system     │
│    - UI patterns → component styles     │
│ 3. Apply to UI_SPEC screens             │
│ 4. Generate HTML mockups                │
└─────────────────────────────────────────┘
```

### Without Reference (Use UI_SPEC Design System)

```
/ipa:design
         ↓
┌─────────────────────────────────────────┐
│ 1. Read docs/UI_SPEC.md design system   │
│ 2. Apply color palette, typography      │
│ 3. Use default component library        │
│ 4. Generate HTML mockups                │
└─────────────────────────────────────────┘
```

---

## Style Presets

| Preset | Description | Best For |
|--------|-------------|----------|
| `minimalist` | Clean, whitespace, subtle | SaaS, Productivity |
| `modern` | Sharp, bold, vibrant | Tech, Startup |
| `glassmorphism` | Blur, transparency, depth | Premium, Luxury |
| `claymorphism` | Soft 3D, playful shadows | Consumer, Lifestyle |
| `brutalist` | Raw, bold typography | Creative, Portfolio |
| `corporate` | Professional, trustworthy | Enterprise, B2B |
| `dashboard` | Data-dense, functional | Admin, Analytics |
| `e-commerce` | Product-focused, CTA heavy | Retail, Marketplace |
| `mobile-first` | Touch-friendly, thumb zones | Mobile apps |
| `dark` | Dark theme, accent colors | Dev tools, Gaming |

**Usage:**
```bash
/ipa:design minimalist
/ipa:design glassmorphism
```

---

## Output Structure

```
docs/prototypes/
├── README.md              # Index + CJX mapping
├── styles.css             # Design system + CJX tokens
├── components.css         # Reusable component styles
├── interactions.js        # CJX-driven animations/micro-interactions
├── icons/                 # Icon assets
│   └── {palette}/
├── s1-{screen}.html       # Screen with CJX stage comment
├── s2-{screen}.html
└── ...
```

### Screen File Structure

Each HTML file includes CJX context:

```html
<!--
  Screen: S-01 Login
  CJX Stage: Onboarding
  User Emotion: Hesitant → Confident
  Design Focus: Trust signals, minimal friction
-->
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Login</title>
  <link rel="stylesheet" href="styles.css">
  <link rel="stylesheet" href="components.css">
</head>
<body class="cjx-onboarding">
  <!-- CJX: Reassuring header with trust signals -->
  <header>...</header>

  <!-- CJX: Minimal form, progress indicator -->
  <main>...</main>

  <script src="interactions.js"></script>
</body>
</html>
```

### interactions.js (CJX-Driven)

```javascript
// CJX Micro-interactions
const cjxInteractions = {
  // Discovery stage: Entrance animations
  discovery: {
    heroEntrance: 'fadeInUp 0.6s ease-out',
    ctaPulse: 'pulse 2s infinite'
  },

  // Onboarding stage: Encouraging feedback
  onboarding: {
    inputFocus: 'borderGlow 0.3s ease',
    progressStep: 'slideRight 0.4s ease',
    successCheck: 'bounceIn 0.5s ease'
  },

  // Usage stage: Smooth efficiency
  usage: {
    tabSwitch: 'fadeSwitch 0.2s ease',
    dataLoad: 'shimmer 1.5s infinite',
    actionComplete: 'successPop 0.3s ease'
  }
};
```

### styles.css (Generated)

```css
/* Design System - Generated from UI_SPEC + Reference */
:root {
  /* Colors (extracted from reference or UI_SPEC) */
  --color-primary: #6366f1;
  --color-primary-hover: #4f46e5;
  --color-secondary: #ec4899;
  --color-background: #ffffff;
  --color-surface: #f8fafc;
  --color-text: #1e293b;
  --color-text-muted: #64748b;
  --color-border: #e2e8f0;
  --color-success: #10b981;
  --color-warning: #f59e0b;
  --color-error: #ef4444;

  /* Typography */
  --font-sans: 'Inter', system-ui, sans-serif;
  --font-mono: 'JetBrains Mono', monospace;
  --text-xs: 0.75rem;
  --text-sm: 0.875rem;
  --text-base: 1rem;
  --text-lg: 1.125rem;
  --text-xl: 1.25rem;
  --text-2xl: 1.5rem;
  --text-3xl: 1.875rem;

  /* Spacing */
  --space-1: 0.25rem;
  --space-2: 0.5rem;
  --space-3: 0.75rem;
  --space-4: 1rem;
  --space-6: 1.5rem;
  --space-8: 2rem;
  --space-12: 3rem;

  /* Effects */
  --radius-sm: 0.375rem;
  --radius-md: 0.5rem;
  --radius-lg: 0.75rem;
  --radius-full: 9999px;
  --shadow-sm: 0 1px 2px rgba(0,0,0,0.05);
  --shadow-md: 0 4px 6px rgba(0,0,0,0.1);
  --shadow-lg: 0 10px 15px rgba(0,0,0,0.1);
  --transition: 150ms ease;
}
```

---

## Quality Gates (Auto-Validated)

Every mockup passes these checks:

| Category | Checks |
|----------|--------|
| **Visual** | Colors from palette, typography scale, spacing rhythm |
| **UX** | Hover states, focus states, transitions 150-300ms |
| **A11Y** | Contrast ≥4.5:1, alt text, keyboard navigable |
| **Responsive** | Mobile (320px+), Tablet (768px+), Desktop (1024px+) |
| **Performance** | Optimized images, minimal CSS, no layout shift |

---

## Usage Examples

```bash
# Generate from UI_SPEC only
/ipa:design

# Clone design from URL
/ipa:design https://linear.app

# Clone from screenshot
/ipa:design ./screenshots/inspiration.png

# Use style preset
/ipa:design dashboard

# Combine: clone color/font from URL, apply to dashboard style
/ipa:design https://notion.so dashboard
```

---

## Iteration Commands

After initial generation, iterate with specific feedback:

```bash
# Fix specific screen
/ipa:design S-01 "make header sticky with blur backdrop"

# Adjust colors
/ipa:design "use darker primary color, more contrast"

# Fix responsiveness
/ipa:design S-03 "fix mobile layout, stack columns"

# Add component
/ipa:design S-02 "add loading skeleton for table"
```

---

## Integration with IPA Workflow

```
/ipa:bd [ref-url]  → docs/UI_SPEC.md (design system extracted)
         ↓
/ipa:design [ref]  → docs/prototypes/ (HTML mockups)
         ↓
Review in browser (open .html files)
         ↓
Iterate: /ipa:design S-xx "fix..."
         ↓
/plan → FE tasks reference docs/prototypes/
         ↓
/code → Implementation matches prototypes
```

---

## App-Specific Templates

| App Type | Preset | Key Screens |
|----------|--------|-------------|
| **SaaS Dashboard** | `dashboard` | Login, Dashboard, Settings, Billing |
| **E-commerce** | `e-commerce` | Home, Product, Cart, Checkout |
| **Mobile App** | `mobile-first` | Onboarding, Home, Profile, Settings |
| **Landing Page** | `modern` | Hero, Features, Pricing, CTA |
| **Admin Panel** | `corporate` | Login, Table View, Form, Analytics |
| **Social App** | `minimalist` | Feed, Profile, Messages, Notifications |

---

## Tips for Best Results

### Before Running

1. **Complete UI_SPEC.md** with screens and components
2. **Provide reference** - URL or image reduces ambiguity significantly
3. **Specify app type** - Helps select appropriate patterns

### Minimize Iterations

| Common Issue | Prevention |
|--------------|------------|
| Wrong colors | Provide reference URL in /ipa:bd first |
| Layout off | Specify app type (dashboard, e-commerce, etc.) |
| Missing states | UI_SPEC should list all component states |
| Not responsive | Always test mobile view before iterating |

---

## 🚦 GATE 3: Design Validation

Before proceeding to `/ipa:detail`:

- [ ] User testing completed with 5+ users
- [ ] Usability issues logged
- [ ] Critical issues addressed in mockups
- [ ] Design matches MVP scope (no gold plating)

**Next:** `/ipa:detail`

## Validation Report

After generation:

```markdown
## Design Generation Report

### Reference Analysis
- Source: https://linear.app
- Extracted: 8 colors, Inter font, 8px spacing grid

### CJX Mapping
| Screen | CJX Stage | User Emotion | Design Applied |
|--------|-----------|--------------|----------------|
| S-01: Login | Onboarding | Hesitant | Trust signals, minimal form |
| S-02: Dashboard | Usage | Engaged | Quick actions, data viz |
| S-03: Settings | Retention | Satisfied | Easy navigation, help access |

### Screens Generated
| Screen | File | CJX Stage | Status |
|--------|------|-----------|--------|
| S-01: Login | s1-login.html | Onboarding | ✅ |
| S-02: Dashboard | s2-dashboard.html | Usage | ✅ |
| S-03: Settings | s3-settings.html | Retention | ✅ |

### Quality Checks
- [x] CJX stages mapped to all screens
- [x] Emotion-based styling applied
- [x] Micro-interactions match journey stage
- [x] Color palette applied
- [x] Typography consistent
- [x] Responsive (3 breakpoints)
- [x] Hover/focus states
- [x] Contrast ratio ≥ 4.5:1

### Files Created
- docs/prototypes/styles.css (with CJX tokens)
- docs/prototypes/components.css
- docs/prototypes/interactions.js (CJX animations)
- docs/prototypes/s1-login.html
- docs/prototypes/s2-dashboard.html
- docs/prototypes/s3-settings.html
```

---

**IMPORTANT:**
- Requires `docs/UI_SPEC.md` to exist
- Generates HTML mockups only, not production code
- Use /code for actual implementation
