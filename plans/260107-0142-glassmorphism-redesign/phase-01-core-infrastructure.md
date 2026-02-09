---
phase: 1
title: "Core Infrastructure"
status: pending
effort: 1h
---

# Phase 1: Core Infrastructure

**Parent:** [plan.md](./plan.md) | **Dependencies:** None

## Overview

Add glassmorphism CSS tokens, utility classes, and toggle UI in Appearance settings.

## Requirements

1. Define glass-specific CSS custom properties
2. Create `.glass` utility classes with variants
3. Add toggle switch in ThemeSelector for `glassmorphismEnabled`
4. Implement `@supports` fallback for non-supporting browsers
5. Add `prefers-reduced-transparency` media query support

## Files to Modify

| File | Changes |
|------|---------|
| `src/renderer/styles/globals.css` | Add glass tokens, utility classes |
| `src/renderer/components/settings/theme-selector.tsx` | Add glassmorphism toggle |
| `src/renderer/App.tsx` | Apply `data-glass` attribute to body |

## Implementation Steps

- [ ] Add glassmorphism CSS tokens to `:root` in globals.css
- [ ] Create `.glass`, `.glass--subtle`, `.glass--medium`, `.glass--heavy` classes
- [ ] Add `@supports (backdrop-filter: blur(10px))` feature detection
- [ ] Add `@media (prefers-reduced-transparency)` fallback
- [ ] Add `data-glass="enabled"` body attribute based on setting
- [ ] Create toggle UI in ThemeSelector with description
- [ ] Test toggle persistence via localStorage

## CSS Tokens to Add

```css
:root {
  --mc-glass-blur-sm: 8px;
  --mc-glass-blur-md: 12px;
  --mc-glass-blur-lg: 20px;
  --mc-glass-bg: rgba(255,255,255,0.05);
  --mc-glass-border: rgba(255,255,255,0.1);
  --mc-glass-shadow: 0 8px 32px rgba(0,0,0,0.2);
  --mc-radius-sm: 6px;
  --mc-radius-md: 12px;
  --mc-radius-lg: 16px;
  --mc-radius-xl: 24px;
}
```

## Success Criteria

- [ ] Glass utility classes work when `[data-glass="enabled"]` present
- [ ] No visual change when glassmorphism disabled
- [ ] Toggle persists across app restarts
- [ ] Graceful fallback on unsupported browsers

## Risks

| Risk | Mitigation |
|------|------------|
| CSS variable conflicts | Use `--mc-glass-*` prefix |
| Light mode contrast issues | Define light-specific glass-bg values |
