# ASCII/Unicode Box-Drawing Borders in Web CSS

**Research Date:** 2026-01-15
**Focus:** Practical CSS implementation for terminal-style UI borders

## Unicode Box-Drawing Character Set (U+2500–U+257F)

### Core Characters
```
Light:  ─ │ ┌ ┐ └ ┘ ├ ┤ ┬ ┴ ┼
Heavy:  ━ ┃ ┏ ┓ ┗ ┛ ┣ ┫ ┳ ┻ ╋
Double: ═ ║ ╔ ╗ ╚ ╝ ╠ ╣ ╦ ╩ ╬
```

### CSS Unicode Escapes
- Top-Left (┌): `\250C`
- Horizontal (─): `\2500`
- Vertical (│): `\2502`
- Top-Right (┐): `\2510`
- Bottom-Left (└): `\2514`
- Bottom-Right (┘): `\2518`

## CSS Implementation Techniques

### 1. Pseudo-Elements (::before/::after) - RECOMMENDED
**Performance:** Best - reduces DOM nodes, negligible rendering impact
**Compatibility:** Full support (Chrome, Firefox, Safari, Edge)

```css
.terminal-card {
  font-family: 'Fira Code', 'JetBrains Mono', 'Consolas', monospace;
  line-height: 1;
  position: relative;
}

.terminal-card::before {
  content: "\250C\2500\2500\2510"; /* ┌──┐ */
  display: block;
}
```

### 2. CSS Custom Properties - THEMING
**Use Case:** Dynamic border styles (light/heavy/double)

```css
:root {
  --border-h: "\2500";  /* ─ */
  --border-v: "\2502";  /* │ */
  --border-tl: "\250C"; /* ┌ */
  --border-tr: "\2510"; /* ┐ */
}

.heavy-theme {
  --border-h: "\2501";  /* ━ */
  --border-v: "\2503";  /* ┃ */
  --border-tl: "\250F"; /* ┏ */
  --border-tr: "\2513"; /* ┓ */
}
```

### 3. CSS Grid for TUI Layouts
**Use Case:** Complex bordered sections

```css
.tui-box {
  display: grid;
  grid-template-columns: 1ch 1fr 1ch;
  grid-template-rows: auto 1fr auto;
  font-family: "Fira Code", monospace;
  line-height: 1;
}
```

## Critical CSS Requirements

### Font Stack (Mandatory)
```css
font-family: 'Fira Code', 'JetBrains Mono', 'Source Code Pro',
             'Consolas', 'Menlo', 'DejaVu Sans Mono', monospace;
```

**Why:** Box-drawing characters require monospace fonts with complete Unicode support. Fallback fonts cause width/height mismatches = broken borders.

### Line-Height Control
```css
line-height: 1.0; /* Eliminate vertical gaps */
```

**Issue:** Default `line-height: normal` (~1.2) creates 1-2px gaps between vertical characters.

### Character Spacing
```css
letter-spacing: 0;
white-space: pre; /* or pre-wrap */
```

### Ch Unit for Sizing
```css
width: 40ch; /* Exactly 40 characters wide */
padding: 0 1ch;
```

**Why:** `1ch` = width of one character in monospace fonts.

## Browser Compatibility

| Feature | Support |
|---------|---------|
| ::before/::after | Chrome, Firefox, Safari, Edge (full) |
| Unicode U+2500 | Universal (font-dependent) |
| CSS custom properties | IE11+ (full modern support) |
| `ch` unit | All modern browsers |

**Legacy:** Use `:before`/`:after` (single colon) for IE8-.

## Performance Considerations

### Pseudo-Elements vs DOM Elements
- **Pseudo-elements:** Lower DOM weight, faster parsing/memory
- **Repaints:** Changing `content` triggers repaint (same as text change)
- **Animations:** No performance issues unless thousands of elements

### Rendering Challenges
1. **Sub-pixel rendering:** Can create micro-gaps at non-integer zoom levels
2. **Font hinting:** OS/browser differences in character positioning
3. **Fallback fonts:** Broken borders if primary font missing characters

**Solution:** `text-rendering: optimizeLegibility;` can help alignment.

## Practical Implementation Patterns

### Card/Modal Border
```css
.terminal-modal {
  font-family: 'Fira Code', monospace;
  line-height: 1;
  padding: 1ch;
}

.terminal-modal::before {
  content: "┌" attr(data-title) "┐";
  display: block;
}

.terminal-modal::after {
  content: "└─────────┘";
  display: block;
}
```

### Container with Side Borders
```css
.terminal-container {
  border-left: 1ch solid transparent;
  position: relative;
}

.terminal-container::before {
  content: "│";
  position: absolute;
  left: 0;
  top: 0;
  bottom: 0;
}
```

## Accessibility
**Issue:** Screen readers may read box-drawing characters aloud.
**Solution:** `aria-hidden="true"` on decorative border elements + semantic container labels.

## Modern Alternatives (When to Avoid Unicode)
- **Pixel-perfect requirements:** Use SVG backgrounds
- **Cross-platform consistency:** CSS `border` properties
- **Complex animations:** CSS Grid + standard borders
- **Accessibility-first:** Semantic HTML + CSS borders

## Unresolved Questions
- Performance impact of 100+ terminal cards with pseudo-element borders on low-end devices?
- Best pattern for responsive terminal borders (mobile vs desktop)?
- Web font hosting strategy vs system fonts for guaranteed Unicode coverage?
