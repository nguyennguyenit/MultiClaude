---
phase: 4
title: "Overlays & Modals"
status: pending
effort: 1h
---

# Phase 4: Overlays & Modals

**Parent:** [plan.md](./plan.md) | **Dependencies:** Phase 1

## Overview

Apply glassmorphism to settings modal, dialogs, and toast notifications.

## Requirements

1. Settings modal: Backdrop blur behind modal
2. Modal panel: Glass effect with visible border
3. Toasts: Subtle glass with accent border
4. Dropdowns/context menus: Light glass effect
5. Config modals (Telegram, Discord): Consistent glass styling

## Files to Modify

| File | Changes |
|------|---------|
| `src/renderer/components/settings/settings-modal.tsx` | Modal glass styling |
| `src/renderer/components/toast-container.tsx` | Toast glass styling |
| `src/renderer/components/settings/telegram-config-modal.tsx` | Config modal |
| `src/renderer/components/settings/discord-config-modal.tsx` | Config modal |
| `src/renderer/styles/globals.css` | Modal/overlay glass rules |

## Implementation Steps

- [ ] Update settings modal backdrop to use `backdrop-blur`
- [ ] Apply `glass--heavy` class to modal panel
- [ ] Add inset shadow for depth: `inset 0 1px 0 rgba(255,255,255,0.1)`
- [ ] Update toast styling with `glass--subtle` + accent left border
- [ ] Add slide-in animation with slight scale (0.95 -> 1.0)
- [ ] Update Telegram/Discord config modals with consistent styling
- [ ] Update modal header/footer with subtle separators
- [ ] Test modal focus trap still works

## Modal Glass Styling

```tsx
{/* Backdrop with blur */}
<div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />

{/* Modal panel */}
<div className={`
  relative glass glass--heavy
  rounded-xl border border-[var(--mc-glass-border)]
  shadow-2xl
`}>
```

## Toast Styling

```css
.toast-glass {
  background: var(--mc-glass-bg);
  backdrop-filter: blur(var(--mc-glass-blur-sm));
  border-left: 3px solid var(--mc-accent);
  border-radius: var(--mc-radius-md);
}
```

## Success Criteria

- [ ] Settings modal has frosted glass appearance
- [ ] Backdrop blur visible behind modal
- [ ] Toasts have subtle glass effect
- [ ] Modal content remains readable
- [ ] ESC key still closes modal

## Risks

| Risk | Mitigation |
|------|------------|
| Performance on many toasts | Limit toast count, use subtle blur |
| Modal text contrast | Use semi-opaque inner content area |
