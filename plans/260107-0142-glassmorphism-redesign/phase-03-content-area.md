---
phase: 3
title: "Content Area"
status: pending
effort: 1.5h
---

# Phase 3: Content Area

**Parent:** [plan.md](./plan.md) | **Dependencies:** Phase 1, Phase 2

## Overview

Update terminal panels, tabs, and resize handles. Terminal areas use high opacity for readability.

## Requirements

1. Terminal background: 90-95% opacity, minimal/no blur
2. Project tabs: Rounded corners, subtle glass on active tab
3. Resize handles: Accent glow on hover
4. Active pane indicator: Soft glow border
5. Tab bar: Light glass effect

## Files to Modify

| File | Changes |
|------|---------|
| `src/renderer/components/terminal/terminal-grid.tsx` | Pane/container styling |
| `src/renderer/components/terminal/terminal-pane.tsx` | Active indicator |
| `src/renderer/components/project-tabs/project-tabs.tsx` | Tab styling |
| `src/renderer/styles/globals.css` | Resize handle glow, pane styles |

## Implementation Steps

- [ ] Update terminal container background to use glass-compatible token
- [ ] Keep terminal viewport solid (90%+ opacity) for text readability
- [ ] Add rounded corners to terminal panels (`--mc-radius-md`)
- [ ] Update `.terminal-resize-handle` with glow effect on hover
- [ ] Update `.terminal-pane-active` box-shadow to soft glow
- [ ] Apply glass styling to project tabs bar
- [ ] Active tab: Slightly elevated, subtle glass highlight
- [ ] Inactive tabs: Transparent, text only
- [ ] Test terminal text contrast after changes

## Terminal Panel Styling

```css
/* Terminal maintains high opacity */
.terminal-container {
  background: var(--mc-terminal-bg, rgba(30,30,30,0.95));
  border-radius: var(--mc-radius-md);
}

/* Resize handle glow */
.terminal-resize-handle:hover {
  box-shadow: 0 0 8px var(--mc-accent);
}
```

## Success Criteria

- [ ] Terminal text remains readable (7:1 contrast)
- [ ] Resize handles glow on hover
- [ ] Active pane has visible glow border
- [ ] Tabs have modern rounded appearance
- [ ] No blur applied to terminal text area

## Risks

| Risk | Mitigation |
|------|------------|
| Terminal text blur | Explicitly set blur: none on terminal viewport |
| Nested glass layers | Only one glass layer in content area |
