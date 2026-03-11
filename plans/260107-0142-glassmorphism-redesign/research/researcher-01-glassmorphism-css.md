# Glassmorphism CSS Implementation Patterns

## 1. Browser Support: `backdrop-filter`

**Status:** Baseline 2024 (widely supported since Sept 2024)

| Browser | Version | Notes |
|---------|---------|-------|
| Chrome | 76+ | Full support |
| Firefox | 103+ | Full support |
| Safari | 9+ | `-webkit-` prefix historically needed |
| Edge | 79+ | Chromium-based, full support |
| Electron | All modern | Uses Chromium, full support |

**Global support:** ~95%+ of browsers

### Fallback Pattern

```css
.glass-panel {
  /* Fallback for unsupported browsers */
  background-color: rgba(255, 255, 255, 0.85);

  /* Feature query for progressive enhancement */
  @supports (backdrop-filter: blur(10px)) {
    background-color: rgba(255, 255, 255, 0.25);
    backdrop-filter: blur(10px);
    -webkit-backdrop-filter: blur(10px); /* Safari legacy */
  }
}
```

## 2. Electron-Specific Best Practices

Electron uses Chromium = full `backdrop-filter` support guaranteed.

### Key Considerations

1. **GPU Acceleration:** Electron enables hardware acceleration by default; blur effects offload to GPU
2. **Reduce Motion:** Respect `prefers-reduced-transparency` media query
3. **Window Vibrancy:** Can combine with native OS blur (macOS vibrancy)

```css
/* Respect OS transparency preferences */
@media (prefers-reduced-transparency: reduce) {
  .glass-panel {
    backdrop-filter: none;
    background-color: rgba(30, 30, 30, 0.95);
  }
}
```

## 3. Performance Optimization

### Performance Impact Factors

| Factor | Impact | Mitigation |
|--------|--------|------------|
| Blur radius | Higher = slower | Keep blur 8-20px |
| Element size | Larger = slower | Limit glass areas |
| Stacking | Multiple layers compound | Max 2-3 glass layers |
| Animation | Very expensive | Never animate blur value |

### Optimization Techniques

```css
/* 1. Promote to GPU layer */
.glass-panel {
  will-change: transform;
  transform: translateZ(0);
  backdrop-filter: blur(12px);
}

/* 2. Contain paint operations */
.glass-container {
  contain: paint;
}

/* 3. Use saturate with blur for richer effect at lower blur */
.glass-panel {
  backdrop-filter: blur(8px) saturate(180%);
  /* Looks similar to blur(16px) but cheaper */
}
```

### Performance Red Flags

- Blur radius > 30px
- Animating `backdrop-filter` property
- Glass panels covering >50% of viewport
- Nested glass elements (blur on blur)

## 4. Accessibility Requirements

### WCAG Contrast Minimums

| Element | Required Ratio |
|---------|----------------|
| Normal text | 4.5:1 |
| Large text (18pt+) | 3:1 |
| UI components/icons | 3:1 |

### Accessible Implementation

```css
.glass-card {
  /* Base glass effect */
  background-color: rgba(255, 255, 255, 0.15);
  backdrop-filter: blur(12px);

  /* Accessibility: solid inner layer for text areas */
  --glass-text-bg: rgba(0, 0, 0, 0.6);

  /* High-contrast border for visual boundaries */
  border: 1px solid rgba(255, 255, 255, 0.2);
  box-shadow: 0 0 0 1px rgba(0, 0, 0, 0.05);
}

.glass-card__content {
  background-color: var(--glass-text-bg);
  padding: 1rem;
}
```

### Key Accessibility Rules

1. Never put critical text directly on pure glass
2. Add semi-opaque overlay behind text content
3. Use high-contrast borders to define boundaries
4. Test against worst-case background scenarios
5. Provide solid fallback when transparency reduced

## 5. CSS Variable Organization

### Three-Layer Token Architecture

```css
:root {
  /* Layer 1: Primitives */
  --blur-sm: 4px;
  --blur-md: 12px;
  --blur-lg: 24px;

  --opacity-glass-light: 0.15;
  --opacity-glass-medium: 0.25;
  --opacity-glass-heavy: 0.45;

  /* Layer 2: Semantic Tokens */
  --glass-blur: var(--blur-md);
  --glass-bg-opacity: var(--opacity-glass-light);
  --glass-border-opacity: 0.2;
  --glass-shadow-opacity: 0.1;

  /* Layer 3: Component Tokens */
  --panel-glass-bg: rgba(255, 255, 255, var(--glass-bg-opacity));
  --panel-glass-border: rgba(255, 255, 255, var(--glass-border-opacity));
  --panel-glass-shadow: 0 8px 32px rgba(0, 0, 0, var(--glass-shadow-opacity));
}

/* Dark theme override */
[data-theme="dark"] {
  --panel-glass-bg: rgba(30, 30, 30, var(--glass-bg-opacity));
  --panel-glass-border: rgba(255, 255, 255, 0.1);
}
```

### Reusable Glass Mixin (via CSS class)

```css
.glass {
  background: var(--panel-glass-bg);
  backdrop-filter: blur(var(--glass-blur));
  -webkit-backdrop-filter: blur(var(--glass-blur));
  border: 1px solid var(--panel-glass-border);
  box-shadow: var(--panel-glass-shadow);
  border-radius: var(--radius-lg, 12px);
}

.glass--subtle { --glass-bg-opacity: 0.08; --glass-blur: var(--blur-sm); }
.glass--medium { --glass-bg-opacity: 0.2; --glass-blur: var(--blur-md); }
.glass--heavy { --glass-bg-opacity: 0.4; --glass-blur: var(--blur-lg); }
```

## Quick Reference: Complete Glass Panel

```css
.glass-panel {
  /* Structure */
  position: relative;
  border-radius: 16px;
  overflow: hidden;

  /* Glass effect */
  background: rgba(255, 255, 255, 0.1);
  backdrop-filter: blur(12px) saturate(150%);
  -webkit-backdrop-filter: blur(12px) saturate(150%);

  /* Depth & boundaries */
  border: 1px solid rgba(255, 255, 255, 0.18);
  box-shadow:
    0 8px 32px rgba(0, 0, 0, 0.12),
    inset 0 1px 0 rgba(255, 255, 255, 0.1);

  /* Performance */
  will-change: transform;
  contain: paint;
}
```

---

## Unresolved Questions

1. Exact performance benchmarks for Electron on lower-end hardware?
2. Interaction between `backdrop-filter` and CSS `mix-blend-mode`?
3. Best practices for glass effects with scrolling content underneath?
