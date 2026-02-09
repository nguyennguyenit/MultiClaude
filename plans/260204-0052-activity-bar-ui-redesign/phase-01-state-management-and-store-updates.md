# Phase 01: State Management & Store Updates

## Context Links

- [App Store](/home/plateau/Desktop/Claude Code/MultiClaude/src/renderer/stores/app-store.ts)
- [Settings Store](/home/plateau/Desktop/Claude Code/MultiClaude/src/renderer/stores/settings-store.ts)
- [Shared Types](/home/plateau/Desktop/Claude Code/MultiClaude/src/shared/types/)

## Overview

- **Priority:** P1 - Foundation for all other phases
- **Status:** pending
- **Effort:** 1h

Replace binary sidebar state (open/collapsed) with 3-state Activity Bar enum.

## Key Insights

- Current store has `sidebarOpen: boolean` and `sidebarCollapsed: boolean`
- Need single enum: `'collapsed' | 'expanded' | 'hidden'`
- State must persist in settings store for cross-session persistence
- Terminal count badge needs reactive access from store

## Requirements

### Functional

- FR-01: Activity Bar state enum with 3 values
- FR-02: Toggle action cycles: collapsed → expanded → hidden → collapsed
- FR-03: State persists in electron-store via settings
- FR-04: Terminal count accessible for badge display

### Non-functional

- NFR-01: Single source of truth for Activity Bar state
- NFR-02: Backward compatible - migrate old sidebarOpen/sidebarCollapsed

## Architecture

```typescript
// New Activity Bar state type
export type ActivityBarState = 'collapsed' | 'expanded' | 'hidden'

// App Store changes
interface AppState {
  // Remove: sidebarOpen, sidebarCollapsed, toggleSidebar, toggleSidebarCollapse
  // Add:
  activityBarState: ActivityBarState
  setActivityBarState: (state: ActivityBarState) => void
  cycleActivityBarState: () => void  // collapsed → expanded → hidden → collapsed
}

// Settings Store changes (for persistence)
interface Settings {
  activityBarState: ActivityBarState  // default: 'collapsed'
}
```

## Related Code Files

### To Modify

| File | Change |
|------|--------|
| `src/renderer/stores/app-store.ts` | Replace sidebar state with activityBarState |
| `src/renderer/stores/settings-store.ts` | Add activityBarState to persisted settings |
| `src/shared/types/settings.ts` | Add ActivityBarState type |
| `src/shared/constants/index.ts` | Add DEFAULT_ACTIVITY_BAR_STATE constant |

### To Create

None

## Implementation Steps

1. **Add type to shared types**
   ```typescript
   // src/shared/types/settings.ts
   export type ActivityBarState = 'collapsed' | 'expanded' | 'hidden'
   ```

2. **Add constant for default**
   ```typescript
   // src/shared/constants/index.ts
   export const DEFAULT_ACTIVITY_BAR_STATE: ActivityBarState = 'collapsed'
   ```

3. **Update app-store.ts**
   - Remove: `sidebarOpen`, `sidebarCollapsed`, `toggleSidebar`, `toggleSidebarCollapse`
   - Add: `activityBarState`, `setActivityBarState`, `cycleActivityBarState`
   - Cycle logic: collapsed → expanded → hidden → collapsed

4. **Update settings-store.ts**
   - Add `activityBarState` to Settings interface
   - Add to default settings
   - Load from electron-store on init
   - Save on change

5. **Sync app-store with settings-store**
   - On app init, read from settings
   - On state change, persist to settings

## Todo List

- [ ] Add ActivityBarState type to shared/types
- [ ] Add DEFAULT_ACTIVITY_BAR_STATE constant
- [ ] Update app-store: remove old sidebar state
- [ ] Update app-store: add new activityBarState
- [ ] Update settings-store: add persistence
- [ ] Test cycle logic works correctly
- [ ] Verify TypeScript compiles without errors

## Success Criteria

- [ ] `activityBarState` has type `'collapsed' | 'expanded' | 'hidden'`
- [ ] `cycleActivityBarState()` cycles through all 3 states in order
- [ ] State loads from settings on app start
- [ ] State persists to settings on change
- [ ] No TypeScript errors after changes
- [ ] Old sidebar properties removed from store

## Risk Assessment

| Risk | Impact | Mitigation |
|------|--------|------------|
| Breaking existing sidebar consumers | High | Update all consumers in Phase 02-03 |
| Settings migration for existing users | Medium | Default to 'collapsed' if missing |

## Security Considerations

None - UI state only, no sensitive data.

## Next Steps

After completion:
- Phase 02 can read activityBarState for logo display
- Phase 03 can use state for Activity Bar rendering
