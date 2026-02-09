# Phase 04: Settings Integration and State Persistence

## Context Links

- [Settings Store](/home/plateau/Desktop/Claude Code/MultiClaude/src/renderer/stores/settings-store.ts)
- [Shared Types](/home/plateau/Desktop/Claude Code/MultiClaude/src/shared/types/)
- [Phase 01](./phase-01-state-management-and-store-updates.md)

## Overview

- **Priority:** P2
- **Status:** pending
- **Effort:** 1h
- **Depends on:** Phases 01-03

Persist Activity Bar state to electron-store and add keyboard shortcut.

## Key Insights

- Settings stored via electron-store in main process
- Settings loaded on app init via `loadSettings()`
- Keyboard shortcut Ctrl+B (Cmd+B on Mac) standard for sidebar toggle
- Need to sync app-store state with settings-store for persistence

## Requirements

### Functional

- FR-01: Activity Bar state persists across app restarts
- FR-02: Ctrl+B (Cmd+B) cycles Activity Bar states
- FR-03: State loads from settings on app init
- FR-04: State saves to settings on change

### Non-functional

- NFR-01: No visible delay when loading saved state
- NFR-02: Settings migration for users upgrading from old version

## Architecture

```
State Flow:
┌────────────────┐     ┌──────────────┐     ┌─────────────────┐
│  App Init      │────▶│ Load Settings │────▶│ Set App Store   │
└────────────────┘     └──────────────┘     └─────────────────┘

┌────────────────┐     ┌──────────────┐     ┌─────────────────┐
│ User Toggle    │────▶│ Update Store  │────▶│ Persist Settings│
└────────────────┘     └──────────────┘     └─────────────────┘
```

## Related Code Files

### To Modify

| File | Change |
|------|--------|
| `src/renderer/stores/settings-store.ts` | Add activityBarState to Settings |
| `src/renderer/hooks/use-keyboard-shortcuts.ts` | Add Ctrl+B handler |
| `src/main/settings/settings-manager.ts` | Add default for new setting |
| `src/shared/types/settings.ts` | Add ActivityBarState to Settings type |

## Implementation Steps

1. **Update shared types**
   ```typescript
   // src/shared/types/settings.ts
   export type ActivityBarState = 'collapsed' | 'expanded' | 'hidden'

   export interface Settings {
     // ... existing
     activityBarState: ActivityBarState
   }
   ```

2. **Update settings-store.ts**
   ```typescript
   // Default settings
   const defaultSettings: Settings = {
     // ... existing
     activityBarState: 'collapsed'
   }

   // Load settings - migrate old sidebarOpen/sidebarCollapsed if present
   loadSettings: async () => {
     const saved = await window.electron.settings.get()
     // Migration logic for old users
     let activityBarState = saved.activityBarState
     if (!activityBarState && saved.sidebarOpen !== undefined) {
       activityBarState = !saved.sidebarOpen ? 'hidden'
         : saved.sidebarCollapsed ? 'collapsed'
         : 'expanded'
     }
     // ...
   }
   ```

3. **Update use-keyboard-shortcuts.ts**
   ```typescript
   // Add Ctrl+B / Cmd+B handler
   useEffect(() => {
     const handleKeyDown = (e: KeyboardEvent) => {
       // Ctrl+B or Cmd+B - cycle Activity Bar
       if ((e.ctrlKey || e.metaKey) && e.key === 'b') {
         e.preventDefault()
         cycleActivityBarState()
       }
       // ... existing shortcuts
     }
     // ...
   }, [cycleActivityBarState])
   ```

4. **Sync on state change**
   ```typescript
   // In app-store or via useEffect in App.tsx
   // When activityBarState changes, persist to settings
   useEffect(() => {
     window.electron.settings.set({ activityBarState })
   }, [activityBarState])
   ```

5. **Update main process settings manager**
   - Add `activityBarState: 'collapsed'` to defaults
   - Handle migration from old settings

## Todo List

- [ ] Add ActivityBarState type to shared/types
- [ ] Update Settings interface with activityBarState
- [ ] Add default value in settings-store
- [ ] Add migration logic for old settings
- [ ] Add Ctrl+B keyboard shortcut
- [ ] Add useEffect to persist state changes
- [ ] Update main process defaults
- [ ] Test persistence across restart
- [ ] Test migration from old settings
- [ ] Test keyboard shortcut works

## Success Criteria

- [ ] State persists when app restarts
- [ ] Ctrl+B (Cmd+B on Mac) cycles states
- [ ] Old users migrated correctly (sidebarOpen → activityBarState)
- [ ] Default state is 'collapsed' for new users
- [ ] No errors in console during load/save

## Risk Assessment

| Risk | Impact | Mitigation |
|------|--------|------------|
| Migration breaks for edge cases | Medium | Test all sidebarOpen/sidebarCollapsed combos |
| Settings file corruption | Low | Use defaults if parse fails |

## Security Considerations

None - UI preference only, no sensitive data.

## Next Steps

After completion:
- Phase 05: Animation polish
- Phase 06: Testing and cleanup
