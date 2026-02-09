# Brainstorm: Auto-Split Terminal Grid Layout

## Problem Statement
Current MultiClaude uses tab-based UI showing only 1 active terminal at a time. User wants auto-split behavior:
- 2 terminals → split 50/50
- 3 terminals → grid layout (2+1)
- 4 terminals → 2x2 grid
- Up to 12 terminals with continued splitting

## Requirements Gathered
| Requirement | Decision |
|-------------|----------|
| Layout type | Grid layout |
| Tab bar | Keep (for focus switching) |
| Resizable | Yes, user can drag to resize |
| Max terminals | 12 |
| Overflow handling | Continue splitting |

## Evaluated Approaches

### Option A: CSS Grid Native
- **Pros:** No dependencies, simple
- **Cons:** Not resizable, fixed ratio only

### Option B: react-resizable-panels ✅ SELECTED
- **Pros:**
  - Resizable with drag handles
  - Lightweight, well-maintained
  - TypeScript support
  - Layout persistence built-in
  - Keyboard accessible
- **Cons:** Additional dependency (~15KB)

### Option C: react-mosaic
- **Pros:** Most flexible, drag-and-drop tiles
- **Cons:** Complex, overkill for this use case

## Final Solution

### Architecture
```
┌─────────────────────────────────────────┐
│  Tab Bar (existing, focus control only) │
├─────────────────────────────────────────┤
│ TerminalGrid (new component)            │
│ ┌─────────────┐ ┌─────────────┐         │
│ │  Terminal 1 │ │  Terminal 2 │         │
│ └─────────────┘ └─────────────┘         │
│ ┌─────────────┐ ┌─────────────┐         │
│ │  Terminal 3 │ │  Terminal 4 │         │
│ └─────────────┘ └─────────────┘         │
└─────────────────────────────────────────┘
```

### Layout Algorithm
| Count | Layout |
|-------|--------|
| 1 | 1 column |
| 2 | 2 columns |
| 3 | 2 cols (row1: 2, row2: 1 full) |
| 4 | 2x2 grid |
| 5-6 | 3 columns |
| 7-9 | 3x3 grid |
| 10-12 | 4 columns |

### Key Components
1. **TerminalGrid** - calculates layout, renders PanelGroups
2. **TerminalPane** - wraps TerminalView with resize handling
3. **Modified App.tsx** - uses TerminalGrid instead of single view

### Implementation Considerations
- xterm.js requires `fit()` on container resize
- Use ResizeObserver or panel `onResize` callback
- Tab bar highlights focused terminal (click to focus)
- All terminals visible simultaneously

## Risks & Mitigations
| Risk | Mitigation |
|------|------------|
| Performance with 12 terminals | Lazy initialization, virtualize if needed |
| xterm resize flicker | Debounce fit() calls |
| Complex nested PanelGroups | Keep algorithm simple, max 2 nesting levels |

## Success Metrics
- Terminals auto-arrange correctly for 1-12 count
- Resize handles work smoothly
- No performance degradation with 4+ terminals
- xterm fits correctly on resize

## Next Steps
Create detailed implementation plan with file changes.
