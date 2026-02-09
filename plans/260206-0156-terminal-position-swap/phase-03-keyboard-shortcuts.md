# Phase 3: Keyboard Shortcuts

## Overview
- Priority: Medium
- Status: Pending
- `Ctrl+Shift+Arrow` to move active terminal in grid direction

## Key Insights
- Existing shortcuts in `use-keyboard-shortcuts.ts`: Alt+1-9, Ctrl+N/T/W/B
- Grid layout is row-major: terminals fill left→right, top→bottom
- Arrow mapping depends on grid dimensions (cols per row)
- Need to calculate adjacent terminal index based on direction + current grid shape

## Related Code Files
- **Modify**: `src/renderer/hooks/use-keyboard-shortcuts.ts` - add Ctrl+Shift+Arrow handlers

## Implementation Steps

### 1. Calculate Adjacent Index
Given current index, cols count, and total count:
- **Left**: `idx - 1` (if not at row start)
- **Right**: `idx + 1` (if not at row end and exists)
- **Up**: `idx - cols` (if row > 0)
- **Down**: `idx + cols` (if exists)

### 2. Add to useKeyboardShortcuts

```typescript
// Ctrl+Shift+Arrow: Move active terminal
if (e.ctrlKey && e.shiftKey && e.key.startsWith('Arrow')) {
  e.preventDefault()
  const { terminals, activeTerminalId, activeProjectId, swapTerminals } = useAppStore.getState()
  if (!activeTerminalId) return

  const projectTerminals = terminals.filter(t =>
    (t.projectId || 'default') === (activeProjectId || 'default')
  )
  const currentIdx = projectTerminals.findIndex(t => t.id === activeTerminalId)
  if (currentIdx === -1) return

  const count = projectTerminals.length
  const cols = calculateGridCols(count) // reuse from terminal-grid.tsx
  let targetIdx = -1

  switch (e.key) {
    case 'ArrowLeft':  targetIdx = currentIdx % cols > 0 ? currentIdx - 1 : -1; break
    case 'ArrowRight': targetIdx = currentIdx % cols < cols - 1 && currentIdx + 1 < count ? currentIdx + 1 : -1; break
    case 'ArrowUp':    targetIdx = currentIdx - cols >= 0 ? currentIdx - cols : -1; break
    case 'ArrowDown':  targetIdx = currentIdx + cols < count ? currentIdx + cols : -1; break
  }

  if (targetIdx >= 0) {
    swapTerminals(projectTerminals[currentIdx].id, projectTerminals[targetIdx].id)
  }
}
```

### 3. Extract Grid Calculation
- Extract `calculateGridCols(count)` to shared utility (used by both `terminal-grid.tsx` and keyboard shortcuts)
- Create `src/renderer/utils/grid-layout.ts`

## Todo
- [ ] Extract `calculateGridCols` to shared utility
- [ ] Add Ctrl+Shift+Arrow handlers to `use-keyboard-shortcuts.ts`
- [ ] Update `KeyboardShortcutsOptions` interface if needed
- [ ] Test all 4 directions with various grid sizes (1-9 terminals)
- [ ] Test boundary cases (top-left corner, bottom-right corner, single terminal)

## Success Criteria
- Ctrl+Shift+Left/Right/Up/Down swaps active terminal with adjacent
- No-op at grid boundaries (no wrap-around)
- Works correctly for all grid configurations (1x1 through 3x4)
