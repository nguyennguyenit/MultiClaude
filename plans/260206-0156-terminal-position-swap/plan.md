# Terminal Position Swap

## Summary
Add drag-and-drop + keyboard shortcuts to reorder terminals within the grid.

## Status: Draft

## Approach
**Native HTML5 Drag & Drop** (zero dependency) + **Keyboard Shortcuts** (Ctrl+Shift+Arrow).

Rationale: Only need simple swap between 2 terminals. `@dnd-kit` adds ~15KB for features we won't use (sortable lists, complex collision detection). Native DnD is sufficient for an Electron desktop app with max 12 terminals. KISS/YAGNI.

## Phases

| # | Phase | Status | File |
|---|-------|--------|------|
| 1 | Store: add reorder action | Pending | [phase-01](./phase-01-store-reorder.md) |
| 2 | Grid: drag-and-drop swap | Pending | [phase-02](./phase-02-grid-dnd-swap.md) |
| 3 | Keyboard shortcuts | Pending | [phase-03](./phase-03-keyboard-shortcuts.md) |

## Key Dependencies
- `react-resizable-panels` (existing) - must not conflict with DnD
- `app-store.ts` Zustand store - add `swapTerminals` action

## Risk
- Panel size reset on reorder - mitigated by using React `key={terminal.id}` for DOM reuse
- xterm.js WebGL context loss - mitigated by only reordering data array, not unmounting components
