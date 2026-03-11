# Phase 3: State Management for Activity Bar Toggle

## Overview

- **Priority:** P1
- **Status:** pending
- **Effort:** 1h

Add 3-state activity bar toggle to app-store. Support keyboard shortcut Ctrl+B. Persist state across sessions.

## Key Insights

- Current sidebar has 2 separate states: `sidebarOpen` (boolean) and `sidebarCollapsed` (boolean)
- Need single state with 3 values: 'collapsed' | 'expanded' | 'hidden'
- Ctrl+B should cycle through states
- State should persist in settings-store for cross-session persistence

## Requirements

### Functional
- 3 states: collapsed (default), expanded, hidden
- Ctrl+B cycles: collapsed -> expanded -> hidden -> collapsed
- Toggle button in activity bar cycles same way
- Hover on left edge when hidden reveals activity bar temporarily
- State persists across app restarts

### Non-Functional
- Remove deprecated `sidebarOpen` and `sidebarCollapsed` from app-store
- Clean migration path for existing users

## Architecture

```
State Transitions:

  +----------+  Ctrl+B   +-----------+  Ctrl+B   +--------+
  | Collapsed| --------> | Expanded  | --------> | Hidden |
  +----------+           +-----------+           +--------+
       ^                                              |
       |                    Ctrl+B                    |
       +----------------------------------------------+

Hover reveal (when hidden):
- Mouse enters left 4px edge -> Show activity bar (expanded)
- Mouse leaves activity bar -> Hide after 300ms delay
```

## Related Code Files

### Files to Modify
- `src/renderer/stores/app-store.ts` - Add activityBarState, remove sidebarOpen/sidebarCollapsed
- `src/renderer/stores/settings-store.ts` - Persist activityBarState
- `src/renderer/hooks/use-keyboard-shortcuts.ts` - Add Ctrl+B handler
- `src/renderer/App.tsx` - Update to use new state, add hover reveal zone
- `src/shared/types.ts` - Add ActivityBarState type if needed

## Implementation Steps

### Step 1: Add ActivityBarState type
```typescript
// src/shared/types.ts (or inline in app-store)
export type ActivityBarState = 'collapsed' | 'expanded' | 'hidden'
```

### Step 2: Update app-store
```typescript
// src/renderer/stores/app-store.ts

// Remove:
// sidebarOpen: boolean
// toggleSidebar: () => void
// sidebarCollapsed: boolean
// toggleSidebarCollapse: () => void

// Add:
activityBarState: ActivityBarState
setActivityBarState: (state: ActivityBarState) => void
cycleActivityBarState: () => void // For toggle button and Ctrl+B

// Implementation:
activityBarState: 'collapsed' as ActivityBarState,

setActivityBarState: (state) => set({ activityBarState: state }),

cycleActivityBarState: () => set((state) => {
  const cycle: Record<ActivityBarState, ActivityBarState> = {
    collapsed: 'expanded',
    expanded: 'hidden',
    hidden: 'collapsed'
  }
  return { activityBarState: cycle[state.activityBarState] }
}),
```

### Step 3: Update keyboard shortcuts
```typescript
// src/renderer/hooks/use-keyboard-shortcuts.ts

// Add to existing shortcuts:
// Ctrl+B - Toggle activity bar
if ((e.ctrlKey || e.metaKey) && e.key === 'b') {
  e.preventDefault()
  useAppStore.getState().cycleActivityBarState()
}
```

### Step 4: Persist state in settings
```typescript
// src/renderer/stores/settings-store.ts

// Add to AppSettings type:
activityBarState?: ActivityBarState

// Load on init:
const activityBarState = savedSettings.activityBarState ?? 'collapsed'
useAppStore.getState().setActivityBarState(activityBarState)

// Save on change (subscribe to app-store):
useAppStore.subscribe(
  (state) => state.activityBarState,
  (activityBarState) => {
    // Debounce and save to settings
  }
)
```

### Step 5: Add hover reveal zone in App.tsx
```tsx
// When activityBarState === 'hidden', show invisible hover zone on left edge
{activityBarState === 'hidden' && (
  <div
    className="absolute left-0 top-0 bottom-0 w-1 z-50 cursor-pointer"
    onMouseEnter={() => setHoverReveal(true)}
  />
)}

{/* Activity bar with hover reveal */}
{(activityBarState !== 'hidden' || hoverReveal) && (
  <div
    onMouseLeave={() => {
      if (activityBarState === 'hidden') {
        setTimeout(() => setHoverReveal(false), 300)
      }
    }}
  >
    <ActivityBar forceExpanded={hoverReveal && activityBarState === 'hidden'} />
  </div>
)}
```

### Step 6: Update all references to old sidebar state
- Search for `sidebarOpen` and `sidebarCollapsed` in codebase
- Replace with `activityBarState` equivalents
- Update component props where needed

## Todo List

- [ ] Add ActivityBarState type
- [ ] Update app-store with new state and actions
- [ ] Remove deprecated sidebar state from app-store
- [ ] Add Ctrl+B keyboard shortcut
- [ ] Add state persistence to settings-store
- [ ] Implement hover reveal zone in App.tsx
- [ ] Update all component references
- [ ] Test state cycling with Ctrl+B
- [ ] Test persistence across app restart
- [ ] Test hover reveal behavior

## Success Criteria

- Ctrl+B cycles through all 3 states
- Toggle button in activity bar works
- State persists after app restart
- Hover on left edge reveals hidden activity bar
- No console errors about undefined sidebar state

## Security Considerations

- None (UI state only)

## Next Steps

- Phase 4: CSS variables and animations for smooth transitions
