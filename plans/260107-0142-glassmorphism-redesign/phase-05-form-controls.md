---
phase: 5
title: "Form Controls"
status: pending
effort: 1h
---

# Phase 5: Form Controls

**Parent:** [plan.md](./plan.md) | **Dependencies:** Phase 1, Phase 4

## Overview

Update buttons, inputs, toggles, and focus states for modern rounded aesthetic.

## Requirements

1. Buttons: Rounded corners, subtle hover glow
2. Input fields: Semi-transparent bg, focus ring
3. Toggle switches: Smooth animation, accent color
4. Checkboxes: Rounded, accent check mark
5. Focus states: Visible focus ring for a11y

## Files to Modify

| File | Changes |
|------|---------|
| `src/renderer/components/settings/theme-selector.tsx` | Mode/theme cards |
| `src/renderer/components/settings/terminal-settings.tsx` | Input/select styles |
| `src/renderer/components/settings/notification-settings.tsx` | Toggle switches |
| `src/renderer/components/settings/settings-modal.tsx` | Footer buttons |
| `src/renderer/styles/globals.css` | Form control base styles |

## Implementation Steps

- [ ] Add button base class with `--mc-radius-md` corners
- [ ] Primary button: accent bg, hover glow effect
- [ ] Secondary button: glass bg, border
- [ ] Input fields: transparent bg, border, focus:ring
- [ ] Add focus-visible ring with accent color for a11y
- [ ] Update ModeCard/ThemeCard with softer corners
- [ ] Create toggle switch component with smooth transition
- [ ] Update settings cards with glass hover state
- [ ] Ensure all interactive elements have visible focus

## Button Styling

```css
.btn-primary {
  background: var(--mc-accent);
  border-radius: var(--mc-radius-md);
  transition: box-shadow 150ms ease;
}
.btn-primary:hover {
  box-shadow: 0 0 12px color-mix(in srgb, var(--mc-accent) 50%, transparent);
}

.btn-secondary {
  background: var(--mc-glass-bg);
  border: 1px solid var(--mc-glass-border);
  border-radius: var(--mc-radius-md);
}
```

## Input Styling

```css
.input-glass {
  background: rgba(255,255,255,0.03);
  border: 1px solid var(--mc-border);
  border-radius: var(--mc-radius-sm);
  transition: border-color 150ms;
}
.input-glass:focus {
  border-color: var(--mc-accent);
  outline: none;
  box-shadow: 0 0 0 2px color-mix(in srgb, var(--mc-accent) 25%, transparent);
}
```

## Success Criteria

- [ ] Buttons have consistent rounded appearance
- [ ] Primary buttons have hover glow
- [ ] Inputs show clear focus state
- [ ] Toggle switches animate smoothly
- [ ] All controls pass keyboard navigation test
- [ ] Focus visible for a11y compliance

## Risks

| Risk | Mitigation |
|------|------------|
| Invisible focus on glass bg | Use solid focus ring, not just border change |
| Button text contrast | Test accent color vs button text |
