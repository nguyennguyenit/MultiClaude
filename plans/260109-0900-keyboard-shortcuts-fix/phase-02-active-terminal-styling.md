# Phase 2: Active Terminal Styling

## Context Links
- Parent plan: [plan.md](./plan.md)
- Dependency: [Phase 1](./phase-01-xterm-shortcut-intercept.md)

## Overview
| Field | Value |
|-------|-------|
| Date | 2026-01-09 |
| Priority | P2 |
| Effort | 30m |
| Implementation | ✅ DONE |
| Review | ✅ DONE |

## Key Insights
- Current `.terminal-pane-active` only uses 2px inset box-shadow - too subtle
- User requested glow effect + animation when switching
- Inactive terminals should be dimmed for better contrast
- CSS `color-mix()` allows dynamic color blending with theme variables

## Requirements
1. Add outer glow effect to active terminal using accent color
2. Animation pulse when terminal becomes active
3. Dim inactive terminals to 0.85 opacity
4. Ensure smooth transitions, no jank

## Related Code Files
| File | Purpose |
|------|---------|
| `src/renderer/styles/globals.css` | Terminal styling - MODIFY |

## Implementation Steps

### Step 1: Update globals.css
Replace existing `.terminal-pane-active` (lines 197-200):

```css
/* Active pane focus indicator with glow */
.terminal-pane-active {
  box-shadow:
    inset 0 0 0 2px var(--mc-accent),
    0 0 20px 2px color-mix(in srgb, var(--mc-accent) 30%, transparent);
  animation: terminal-activate 0.3s ease-out;
}

/* Dim inactive terminals for contrast */
.terminal-pane:not(.terminal-pane-active) {
  opacity: 0.85;
  transition: opacity 0.2s ease;
}

/* Prevent animation replay on page load */
.terminal-pane-active {
  animation-fill-mode: forwards;
}

@keyframes terminal-activate {
  0% {
    box-shadow:
      inset 0 0 0 3px var(--mc-accent),
      0 0 40px 8px color-mix(in srgb, var(--mc-accent) 50%, transparent);
  }
  100% {
    box-shadow:
      inset 0 0 0 2px var(--mc-accent),
      0 0 20px 2px color-mix(in srgb, var(--mc-accent) 30%, transparent);
  }
}
```

## Todo List
- [x] Update `.terminal-pane-active` with glow effect
- [x] Add inactive terminal dimming
- [x] Add `@keyframes terminal-activate` animation
- [x] Test with multiple terminals (2, 4, 9 terminals)
- [x] Test across different color themes
- [x] Verify animation performance

## Success Criteria
- [x] Active terminal has visible outer glow
- [x] Glow color matches current theme accent
- [x] Animation plays smoothly when switching terminals
- [x] Inactive terminals are visibly dimmer
- [x] No performance issues with 9+ terminals

## Risk Assessment
| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Animation causes jank | Low | Medium | Use `will-change` if needed |
| color-mix() browser support | Very Low | Low | Chrome 111+, all modern browsers support |
| Opacity affects WebGL | Low | Low | Only affects opacity, not WebGL context |

## Security Considerations
- No security concerns - pure CSS styling
