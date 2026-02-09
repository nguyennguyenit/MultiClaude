# Brainstorm: Responsive Scroll Button

## Problem Statement
Scroll-to-bottom button in terminal view has fixed size (`p-2`, `w-4 h-4` icon). Need size to adapt based on terminal container dimensions for better UX across different terminal sizes in multi-agent grid layout.

## Requirements
- **Base size**: 3-4% of terminal width
- **Min-width**: 20px (ensure clickable)
- **Max-width**: 32px (prevent oversized on wide terminals)
- **Aspect ratio**: Square (width = height)
- **Trigger**: Width-based scaling

## Evaluated Approaches

### 1. CSS clamp() with Viewport Units
- Uses `vw` or percentage units
- **Issue**: Scales relative to viewport, not terminal container

### 2. CSS Container Queries (Selected)
- Uses `cqw` (container query width) unit
- Container-relative sizing via `clamp(20px, 4cqw, 32px)`
- Pure CSS, declarative, no JS state
- **Pros**: Zero overhead, instant resize, Electron 33 supports it
- **Cons**: None for this use case

### 3. ResizeObserver + State
- JS observes container width, updates state
- **Issue**: Re-renders on every resize, over-engineered for CSS-solvable problem

## Selected Solution: CSS Container Queries

### Implementation Steps
1. Add `container-type: size` to `.terminal-container-wrapper` (or inline style)
2. Replace fixed button styling with:
   ```css
   button {
     width: clamp(20px, 4cqw, 32px);
     height: clamp(20px, 4cqw, 32px);
     padding: clamp(4px, 1cqw, 8px);
   }
   svg {
     width: clamp(12px, 2cqw, 16px);
     height: clamp(12px, 2cqw, 16px);
   }
   ```
3. Adjust `bottom`/`right` positioning to scale proportionally if needed

### File Changes
- `src/renderer/components/terminal/terminal-view.tsx`: Update button styles

### Risks
- None significant. Container queries well-supported in Electron 33 (Chromium 128).

## Success Criteria
- Button size scales smoothly with terminal width
- Min 20px, max 32px bounds respected
- No layout shift or jank during resize
- Works across all terminals in grid layout

## Next Steps
- Implement CSS changes in `terminal-view.tsx`
- Test with different terminal grid configurations (1x1, 2x2, 3x4)
