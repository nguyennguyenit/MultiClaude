# Terminal App UI Design Patterns Research

**Date:** 2026-01-07 | **Focus:** Modern terminal UI patterns for MultiClaude glassmorphism redesign

---

## 1. Warp Terminal UI Architecture

### Core Design Principles
- **Block Model**: Commands/outputs as discrete blocks (selectable, shareable, copyable)
- **IDE-like Input**: Multi-line editing, text selection, familiar shortcuts
- **GPU-Accelerated**: 60 FPS via wgpu, Metal/Vulkan/DirectX backends
- **Rich Components**: Snackbars, overflow menus, interactive panels beyond text

### Design Tokens (Inferred)
| Token | Value Pattern |
|-------|---------------|
| Border radius | 8-12px for blocks |
| Spacing | 12-16px between blocks |
| Font | Monospace with ligatures |
| Shadows | Subtle elevation for blocks |

### Key Takeaways
- Blocks create visual hierarchy in output
- Distinct input area vs output area styling
- Command palette for discoverability

---

## 2. Hyper Terminal Styling

### Architecture
- Electron-based (HTML/CSS/JS)
- CSS injection via `.hyper.js` config
- Plugin/theme ecosystem via npm

### Stylable Components
```css
.hyper_main        /* root container */
.header_header     /* tab bar */
.tabs_list         /* tabs container */
.tab_tab           /* individual tabs */
.terms_terms       /* terminal viewport */
```

### CSS Customization Pattern
```javascript
config: {
  css: `/* window/header/tabs */`,
  termCSS: `/* terminal buffer */`,
  backgroundColor: 'rgba(0,0,0,0.85)',
  padding: '12px 14px'
}
```

### Key Takeaways
- Separation of chrome CSS vs terminal CSS
- RGBA backgrounds enable transparency
- Font smoothing critical for readability

---

## 3. iTerm2 Appearance Patterns

### Transparency Features
- Window transparency: 0-100% opacity slider
- Blur: Background blur for transparent windows
- Dimming: Inactive pane/window dimming

### Visual Tokens
| Element | Common Values |
|---------|---------------|
| Blur radius | 10-30px |
| Opacity | 85-95% for readability |
| Border | 1px subtle separator |
| Tab height | 28-32px |

### Key Takeaways
- High opacity (85%+) maintains text legibility
- Blur softens background without distraction
- Minimal chrome maximizes terminal space

---

## 4. Modern Terminal Sidebar Patterns

### Common Layouts
1. **Collapsible**: Icon-only (48px) vs expanded (200-280px)
2. **Persistent**: Always visible, fixed width
3. **Overlay**: Slides over content, modal-like

### Visual Hierarchy
- **Primary actions**: Top-aligned, prominent icons
- **Navigation**: Middle section, grouped by function
- **Settings/Profile**: Bottom-aligned

### Design Tokens
| Token | Recommended |
|-------|-------------|
| Width collapsed | 48-56px |
| Width expanded | 200-280px |
| Icon size | 20-24px |
| Item height | 36-44px |
| Divider | 1px or 8-12px gap |

### Key Takeaways
- Icons + tooltips for collapsed state
- Smooth width transitions (200-300ms ease)
- Active state: background highlight + accent border

---

## 5. Glassmorphism + Terminal Best Practices

### Core Properties
```css
.glass-surface {
  background: rgba(255, 255, 255, 0.05);  /* dark theme */
  backdrop-filter: blur(12px);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 12px;
}
```

### Performance Considerations
- `backdrop-filter` is GPU-intensive
- Limit blur layers (max 2-3 stacked)
- Use `will-change: transform` sparingly
- Avoid blur on rapidly updating content (terminal output)

### Readability Rules
| Context | Min Contrast | Background Opacity |
|---------|--------------|-------------------|
| Terminal text | 7:1 (WCAG AAA) | 85-95% |
| UI chrome | 4.5:1 (WCAG AA) | 60-80% |
| Decorative | N/A | 10-40% |

### Terminal-Specific Adaptations
- **Terminal area**: Higher opacity (90%+), no/minimal blur on text layer
- **Sidebar/chrome**: Full glassmorphism (60-80% opacity, blur)
- **Borders**: Subtle light borders for depth
- **Shadows**: Soft, large-radius shadows (0 8px 32px rgba)

---

## 6. Recommendations for MultiClaude

### Component Strategy
| Component | Opacity | Blur | Border |
|-----------|---------|------|--------|
| Sidebar | 70-80% | 16px | 1px light |
| Terminal bg | 90-95% | 0-8px | none |
| Header/tabs | 75-85% | 12px | 1px bottom |
| Modals/overlays | 60-70% | 20px | 1px light |

### Design Tokens to Define
```css
:root {
  /* Glass surfaces */
  --glass-bg-subtle: rgba(255, 255, 255, 0.03);
  --glass-bg-medium: rgba(255, 255, 255, 0.06);
  --glass-bg-strong: rgba(255, 255, 255, 0.10);
  --glass-border: rgba(255, 255, 255, 0.08);
  --glass-blur-sm: 8px;
  --glass-blur-md: 16px;
  --glass-blur-lg: 24px;

  /* Spacing */
  --space-xs: 4px;
  --space-sm: 8px;
  --space-md: 12px;
  --space-lg: 16px;
  --space-xl: 24px;

  /* Radii */
  --radius-sm: 6px;
  --radius-md: 10px;
  --radius-lg: 14px;
}
```

### Implementation Priority
1. Define CSS custom properties (tokens)
2. Apply glass to sidebar first (most visible)
3. Header/tab bar second
4. Terminal background last (preserve readability)

---

## Unresolved Questions

1. Should terminal output area use any blur, or solid background only?
2. Preferred animation timing for sidebar collapse?
3. How to handle high-contrast/accessibility mode?
4. Performance budget for backdrop-filter on low-end hardware?

---

**Sources:**
- Warp Terminal architecture blog
- Hyper Terminal documentation
- iTerm2 appearance settings
- WCAG 2.1 contrast guidelines
