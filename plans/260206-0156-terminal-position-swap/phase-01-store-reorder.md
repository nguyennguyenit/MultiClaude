# Phase 1: Store - Add Reorder Action

## Overview
- Priority: High
- Status: Pending
- Add `swapTerminals(id1, id2)` action to Zustand store

## Key Insights
- `terminals[]` array order determines grid rendering order
- Swap = find indices of both IDs, swap elements in array
- Must filter by `projectId` - only swap within same project
- `ProjectTerminal.position` type exists but unused - not needed for this approach (array order IS the position)

## Related Code Files
- **Modify**: `src/renderer/stores/app-store.ts` - add `swapTerminals` action

## Implementation Steps

1. Add `swapTerminals: (id1: string, id2: string) => void` to `AppState` interface
2. Implement: find indices, swap in-place, return new array
3. Ensure both terminals belong to same project (guard)

## Code Sketch

```typescript
swapTerminals: (id1, id2) =>
  set((state) => {
    const idx1 = state.terminals.findIndex(t => t.id === id1)
    const idx2 = state.terminals.findIndex(t => t.id === id2)
    if (idx1 === -1 || idx2 === -1) return state
    // Guard: same project
    if (state.terminals[idx1].projectId !== state.terminals[idx2].projectId) return state
    const newTerminals = [...state.terminals]
    ;[newTerminals[idx1], newTerminals[idx2]] = [newTerminals[idx2], newTerminals[idx1]]
    return { terminals: newTerminals }
  }),
```

## Todo
- [ ] Add `swapTerminals` to AppState interface
- [ ] Implement swap logic with project guard
- [ ] Verify grid re-renders correctly after swap

## Success Criteria
- Calling `swapTerminals(a, b)` swaps their positions in the grid
- Terminals in other projects unaffected
