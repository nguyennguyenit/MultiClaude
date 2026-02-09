# Phase 1: Atomic State Update

## Context Links
- [Plan Overview](./plan.md)
- [Zustand Batching Research](./research/researcher-02-zustand-batching.md)
- [Root Cause Analysis](../reports/brainstorm-260114-2156-cursor-display-project-switch.md)

## Overview
**Priority:** P0 (Critical)
**Status:** pending
**Effort:** 1h

Bundle `activeProjectId` and `activeTerminalId` updates into single Zustand action to prevent intermediate inconsistent states.

## Key Insights
- Current: 2 separate `set()` calls = 2 render cycles
- React 18 batching prevents multiple renders BUT doesn't guarantee atomic state consistency
- Intermediate state: `activeProjectId=newProject`, `activeTerminalId=oldTerminal`
- Solution: Single `set()` with computed terminal ID

## Requirements
### Functional
- Single action to switch project + auto-select first terminal
- Optional terminal ID override for explicit selection
- Preserve existing `setActiveProject` for backwards compat

### Non-Functional
- No additional re-renders
- Type-safe API

## Architecture

```typescript
// app-store.ts - Add new action
switchToProject: (projectId: string, terminalId?: string) =>
  set((state) => {
    const projectTerminals = state.terminals.filter(t => t.projectId === projectId)
    return {
      activeProjectId: projectId,
      activeTerminalId: terminalId ?? projectTerminals[0]?.id ?? null
    }
  })
```

## Related Code Files
**Modify:**
- `src/renderer/stores/app-store.ts` - Add `switchToProject` action
- `src/renderer/App.tsx` - Use `switchToProject` in `handleSelectProject`

## Implementation Steps

1. **Add `switchToProject` action to app-store.ts**
   - After line 103, add new action
   - Keep existing `setActiveProject` for other use cases

2. **Update App.tsx handleSelectProject**
   - Replace separate `setActiveProject` + `setActiveTerminal` calls
   - Use new `switchToProject` action

3. **Verify type exports**
   - Ensure `switchToProject` is in AppState interface

## Todo List
- [ ] Add `switchToProject` action to AppState interface (line 26)
- [ ] Implement `switchToProject` action body (line 103)
- [ ] Update handleSelectProject in App.tsx (lines 99-105)
- [ ] Test: Switch between 2 projects
- [ ] Test: Switch A->B->C->A pattern

## Success Criteria
- Single render cycle when switching projects
- `activeProjectId` and `activeTerminalId` always consistent
- No intermediate state where project != terminal's project

## Risk Assessment
| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| Breaking existing consumers | Low | Medium | Keep `setActiveProject` for backwards compat |
| Stale terminal list | Low | Low | Use functional update `set((state) => ...)` |

## Security Considerations
- None - UI state only, no sensitive data

## Next Steps
- Phase 2: Add hidden->visible focus trigger to ensure cursor appears after state update
