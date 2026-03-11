---
phase: 2
title: "Navigation Chrome"
status: pending
effort: 1.5h
---

# Phase 2: Navigation Chrome

**Parent:** [plan.md](./plan.md) | **Dependencies:** Phase 1

## Overview

Apply glassmorphism to Sidebar and TitleBar when enabled. Smooth transitions between states.

## Requirements

1. Sidebar: Semi-transparent background + backdrop blur when enabled
2. TitleBar: Subtle glass effect with proper drag regions
3. Transition smoothly when toggling glassmorphism on/off
4. Collapsed sidebar maintains glass effect
5. Navigation items hover states updated

## Files to Modify

| File | Changes |
|------|---------|
| `src/renderer/components/sidebar/sidebar.tsx` | Conditional glass classes |
| `src/renderer/components/sidebar/sidebar-header.tsx` | Header glass styling |
| `src/renderer/components/sidebar/navigation-item.tsx` | Hover/active states |
| `src/renderer/components/sidebar/user-account-card.tsx` | Card styling |
| `src/renderer/styles/globals.css` | Sidebar-specific glass rules |

## Implementation Steps

- [ ] Add `useSettingsStore` hook to Sidebar to read `glassmorphismEnabled`
- [ ] Apply conditional `glass` class to sidebar container
- [ ] Update sidebar background: `bg-[var(--mc-bg-secondary)]` -> glass variant
- [ ] Add `border-r` with glass border color when enabled
- [ ] Update SidebarHeader with glass styling
- [ ] Update NavigationItem hover: subtle glass highlight
- [ ] Update UserAccountCard with glass panel styling
- [ ] Add CSS transition for background/blur changes (200ms ease)
- [ ] Test collapsed state retains glass effect

## Sidebar Glass Styling

```tsx
// Conditional class logic
const glassClass = glassmorphismEnabled
  ? 'glass glass--medium'
  : 'bg-[var(--mc-bg-secondary)]'
```

## Success Criteria

- [ ] Sidebar has glass effect when enabled
- [ ] No layout shift during toggle
- [ ] Collapsed sidebar still shows glass
- [ ] Smooth 200ms transition
- [ ] Settings button visible and functional

## Risks

| Risk | Mitigation |
|------|------------|
| Sidebar icons hard to see | Ensure icon contrast on glass bg |
| Performance on resize | Limit blur to sidebar only |
