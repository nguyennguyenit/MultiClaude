# Phase 2: Grid - Drag and Drop Swap

## Overview
- Priority: High
- Status: Pending
- Native HTML5 DnD on terminal header bars to swap positions

## Key Insights
- Header bar (24px, `terminal-pane.tsx:141`) is the drag handle
- Drop target = entire terminal pane area
- On drop: call `swapTerminals(draggedId, targetId)`
- Visual feedback: highlight drop target with accent border
- Ghost/preview: browser's native drag ghost (header bar snapshot)
- Must NOT interfere with `react-resizable-panels` separator handles

## Related Code Files
- **Modify**: `src/renderer/components/terminal/terminal-pane.tsx` - add drag source + drop target
- **Modify**: `src/renderer/components/terminal/terminal-grid.tsx` - minor: pass swap handler

## Implementation Steps

### 1. TerminalPane: Drag Source (header bar)
- Add `draggable="true"` to header `<div>`
- `onDragStart`: set `dataTransfer.setData('terminal-id', terminalId)` + set effectAllowed = "move"
- `onDragEnd`: cleanup drag state

### 2. TerminalPane: Drop Target (entire pane)
- `onDragOver`: `e.preventDefault()` + set `dropEffect = "move"` + show visual indicator
- `onDragEnter`/`onDragLeave`: toggle CSS class for highlight
- `onDrop`: read `dataTransfer.getData('terminal-id')`, call `onSwap(draggedId, terminalId)`

### 3. Visual Feedback
- Dragging state: dim original pane (opacity: 0.5)
- Drop target hover: accent border glow (reuse existing `terminal-pane-active` pattern)
- CSS class: `.terminal-pane-drop-target` with `box-shadow: inset 0 0 0 2px var(--mc-accent)`

### 4. TerminalGrid: Wire Up
- Pass `onSwapTerminals` callback from App → Grid → Pane
- Grid calls `useAppStore.getState().swapTerminals(id1, id2)`

## Props Changes

```typescript
// terminal-pane.tsx - add:
onSwap?: (draggedId: string, targetId: string) => void
```

```typescript
// terminal-grid.tsx - add:
onSwapTerminals?: (id1: string, id2: string) => void
```

## Todo
- [ ] Add drag handlers to header bar in TerminalPane
- [ ] Add drop handlers to TerminalPane container
- [ ] Add visual feedback CSS classes
- [ ] Wire up onSwapTerminals through Grid → Pane
- [ ] Test: drag terminal A header onto terminal B → positions swap
- [ ] Test: resize handles still work after adding DnD
- [ ] Test: xterm.js state preserved after swap

## Risk Assessment
- **react-resizable-panels conflict**: Low risk - drag starts on header bar, resize starts on Separator. Different DOM elements, no overlap.
- **xterm.js state loss**: Low risk - React reconciles by `key={terminal.id}`, so xterm instance stays mounted. Only array order changes.
- **Panel size reset**: Medium risk - `react-resizable-panels` may reset sizes when children order changes. If this happens, we'll need to persist panel sizes in store.

## Success Criteria
- Drag terminal header onto another terminal → positions swap
- Visual feedback during drag (dim source, highlight target)
- xterm.js scroll position, buffer content, WebGL state preserved
- Resize handles unaffected
