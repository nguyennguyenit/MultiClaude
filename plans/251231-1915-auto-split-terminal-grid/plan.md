---
title: "Auto-Split Terminal Grid Layout"
description: "Replace tab-only view with auto-splitting grid that shows all terminals simultaneously"
status: completed
priority: P2
effort: 3h
issue: null
branch: master
tags: [frontend, feature, ui]
created: 2025-12-31
completed: 2025-12-31T23:37:00
---

# Auto-Split Terminal Grid Layout

## Overview

Transform current tab-based terminal view (1 active at a time) to auto-splitting grid layout showing all terminals simultaneously with resizable panels.

## Requirements

| Requirement | Decision |
|-------------|----------|
| Layout type | Grid (2x2, 3x3, etc.) |
| Tab bar | Keep for focus switching |
| Resizable | Yes, drag between panes |
| Max terminals | 12 |
| Overflow | Continue splitting |

## Architecture

```
┌─────────────────────────────────────────┐
│  Tab Bar (focus control, highlight)     │
├─────────────────────────────────────────┤
│ TerminalGrid                            │
│ ┌─────────────┬─────────────┐           │
│ │  Terminal 1 │  Terminal 2 │           │
│ ├─────────────┼─────────────┤           │
│ │  Terminal 3 │  Terminal 4 │           │
│ └─────────────┴─────────────┘           │
└─────────────────────────────────────────┘
```

## Layout Algorithm

```typescript
function calculateGrid(count: number): { rows: number; cols: number } {
  if (count <= 1) return { rows: 1, cols: 1 }
  if (count <= 2) return { rows: 1, cols: 2 }
  if (count <= 4) return { rows: 2, cols: 2 }
  if (count <= 6) return { rows: 2, cols: 3 }
  if (count <= 9) return { rows: 3, cols: 3 }
  return { rows: 3, cols: 4 } // max 12
}
```

| Count | Layout |
|-------|--------|
| 1 | 1×1 |
| 2 | 1×2 (horizontal) |
| 3-4 | 2×2 |
| 5-6 | 2×3 |
| 7-9 | 3×3 |
| 10-12 | 3×4 |

## Implementation Phases

### Phase 1: Create TerminalGrid Component

**File:** `src/renderer/components/terminal/terminal-grid.tsx` (CREATE)

```tsx
import { PanelGroup, Panel, PanelResizeHandle } from 'react-resizable-panels'
import type { Terminal } from '@shared/types'

interface TerminalGridProps {
  terminals: Terminal[]
  activeTerminalId: string | null
  onTerminalClick: (id: string) => void
}
```

**Tasks:**
1. Create `calculateGrid()` utility function
2. Build nested PanelGroup structure (vertical → horizontal rows)
3. Render TerminalPane in each panel
4. Add resize handles between panels

### Phase 2: Create TerminalPane Component

**File:** `src/renderer/components/terminal/terminal-pane.tsx` (CREATE)

Wraps TerminalView with:
- Click handler to set focus
- Visual focus indicator (border)
- ResizeObserver to call `fit()` on size change

```tsx
interface TerminalPaneProps {
  terminalId: string
  isActive: boolean
  onActivate: () => void
}
```

**Tasks:**
1. Create wrapper with click-to-focus
2. Add ResizeObserver for xterm fit
3. Add visual focus ring (border highlight)
4. Debounce fit() calls (100ms)

### Phase 3: Modify TerminalView

**File:** `src/renderer/components/terminal/terminal-view.tsx` (MODIFY)

**Changes:**
1. Remove `hidden` class logic - always visible
2. Accept `onResize` callback prop
3. Expose `fit()` via ref or callback

### Phase 4: Update App.tsx

**File:** `src/renderer/App.tsx` (MODIFY)

**Changes:**
1. Replace single TerminalView loop with TerminalGrid
2. Pass terminals array to TerminalGrid
3. Handle terminal click → setActiveTerminal

```diff
- {terminals.map((terminal) => (
-   <TerminalView
-     key={terminal.id}
-     terminalId={terminal.id}
-     isActive={terminal.id === activeTerminalId}
-   />
- ))}
+ <TerminalGrid
+   terminals={terminals}
+   activeTerminalId={activeTerminalId}
+   onTerminalClick={setActiveTerminal}
+ />
```

### Phase 5: Update TerminalTabs Styling

**File:** `src/renderer/components/terminal/terminal-tabs.tsx` (MODIFY)

**Changes:**
1. Highlight active tab more prominently
2. Optional: Add terminal number badge
3. Click tab → focus that terminal (scroll into view not needed since all visible)

### Phase 6: Add CSS for Resize Handles

**File:** `src/renderer/index.css` (MODIFY)

Add styles for:
- Resize handle appearance (subtle line)
- Hover state (thicker line)
- Active pane border highlight

```css
[data-panel-resize-handle-id] {
  background: #3c3c3c;
  transition: background 0.15s;
}
[data-panel-resize-handle-id]:hover {
  background: #007acc;
}
.terminal-pane-active {
  box-shadow: inset 0 0 0 2px #007acc;
}
```

## File Changes Summary

| File | Action | Description |
|------|--------|-------------|
| `src/renderer/components/terminal/terminal-grid.tsx` | CREATE | Grid layout component |
| `src/renderer/components/terminal/terminal-pane.tsx` | CREATE | Pane wrapper with resize handling |
| `src/renderer/components/terminal/terminal-view.tsx` | MODIFY | Remove hidden logic, always visible |
| `src/renderer/components/terminal/index.ts` | MODIFY | Export new components |
| `src/renderer/App.tsx` | MODIFY | Use TerminalGrid |
| `src/renderer/index.css` | MODIFY | Resize handle & focus styles |

## Technical Considerations

### xterm.js Resize Handling
- Use ResizeObserver on each pane container
- Debounce `fit()` to avoid excessive calls during drag
- Call `fit()` after panel resize settles

### Performance
- React.memo on TerminalPane to prevent re-renders
- Each xterm instance already uses WebGL addon
- 12 terminals should be fine, but monitor memory

### Focus Management
- Click anywhere in pane → setActiveTerminal
- Tab bar click → setActiveTerminal
- Keyboard focus follows activeTerminalId

## Testing Checklist

- [ ] 1 terminal fills entire space
- [ ] 2 terminals split 50/50 horizontal
- [ ] 3 terminals: 2 top, 1 bottom (full width)
- [ ] 4 terminals: 2×2 grid
- [ ] Drag resize handle works smoothly
- [ ] xterm resizes correctly during/after drag
- [ ] Click pane → focuses terminal
- [ ] Tab bar highlight syncs with focused pane
- [ ] Create/close terminal updates grid layout
- [ ] No memory leaks with 12 terminals

## Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| xterm flicker on resize | Debounce fit() 100ms |
| Performance with many terminals | Monitor, lazy init if needed |
| Complex nested PanelGroups | Keep max 2 nesting levels |
| Focus confusion | Clear visual indicator on active pane |
