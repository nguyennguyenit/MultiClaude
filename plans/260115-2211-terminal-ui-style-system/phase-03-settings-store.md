# Phase 03: Settings Store

## Context
- Parent: [plan.md](./plan.md)
- Depends on: Phase 01

## Overview
- **Priority**: High
- **Status**: Pending
- **Effort**: 1h
- **Description**: Update Zustand settings store and main process validation

## Key Insights
- Extend existing settings-store.ts with new actions
- Update main process schema validation
- Follow existing Save/Cancel flow pattern
- pendingSettings + savedSettings architecture

## Requirements

### Functional
- Add setUiStyle action
- Add setTerminalStyleOptions action
- Validate uiStyle: 'modern' | 'terminal'
- Validate terminalStyleOptions structure
- Persist new settings to electron-store

### Non-Functional
- Maintain Save/Cancel flow
- Field-by-field equality check

## Architecture

```typescript
// Zustand actions
setUiStyle: (style: UiStyle) => void
setTerminalStyleOptions: (options: Partial<TerminalStyleOptions>) => void

// Main process validation
if (settings.uiStyle && !['modern', 'terminal'].includes(settings.uiStyle)) {
  settings.uiStyle = 'modern'
}
```

## Related Code Files

### Modify
| File | Changes |
|------|---------|
| `src/renderer/stores/settings-store.ts` | Add setUiStyle, setTerminalStyleOptions actions |
| `src/main/settings/settings-store.ts` | Add validation for new fields |

## Implementation Steps

1. Update `src/renderer/stores/settings-store.ts`:
   ```typescript
   // Add to SettingsState interface
   setUiStyle: (style: UiStyle) => void
   setTerminalStyleOptions: (options: Partial<TerminalStyleOptions>) => void

   // Add implementations in create()
   setUiStyle: (style) => set((state) => ({
     pendingSettings: { ...state.pendingSettings, uiStyle: style }
   })),

   setTerminalStyleOptions: (options) => set((state) => ({
     pendingSettings: {
       ...state.pendingSettings,
       terminalStyleOptions: {
         ...state.pendingSettings.terminalStyleOptions,
         ...options
       }
     }
   })),
   ```

2. Update equality check function to include new fields:
   ```typescript
   const settingsEqual = (a: AppSettings, b: AppSettings): boolean => {
     return (
       // ... existing comparisons
       a.uiStyle === b.uiStyle &&
       a.terminalStyleOptions?.colorPreset === b.terminalStyleOptions?.colorPreset &&
       a.terminalStyleOptions?.fontFamily === b.terminalStyleOptions?.fontFamily &&
       a.terminalStyleOptions?.useBorderChars === b.terminalStyleOptions?.useBorderChars
     )
   }
   ```

3. Update `src/main/settings/settings-store.ts` validation:
   ```typescript
   // Add validation in validateSettings() or SETTINGS_SET handler
   if (settings.uiStyle !== undefined) {
     if (!['modern', 'terminal'].includes(settings.uiStyle)) {
       settings.uiStyle = 'modern'
     }
   }

   if (settings.terminalStyleOptions !== undefined) {
     const opts = settings.terminalStyleOptions
     if (!opts || typeof opts !== 'object') {
       settings.terminalStyleOptions = DEFAULT_SETTINGS.terminalStyleOptions
     } else {
       if (!['green', 'blue', 'white'].includes(opts.colorPreset)) {
         opts.colorPreset = 'green'
       }
       if (typeof opts.fontFamily !== 'string') {
         opts.fontFamily = 'jetbrains-mono'
       }
       if (typeof opts.useBorderChars !== 'boolean') {
         opts.useBorderChars = false
       }
     }
   }
   ```

4. Add imports for new types:
   ```typescript
   import type { UiStyle, TerminalStyleOptions } from '@shared/types'
   ```

## Todo List
- [ ] Add setUiStyle action to settings-store.ts
- [ ] Add setTerminalStyleOptions action
- [ ] Update settingsEqual function
- [ ] Add validation in main process
- [ ] Import new types
- [ ] Test save/load cycle

## Success Criteria
- Actions update pendingSettings correctly
- Save persists new fields to disk
- Load restores new fields
- Invalid values fallback to defaults

## Risk Assessment
| Risk | Mitigation |
|------|------------|
| Breaking existing settings file | New fields get defaults if missing |
| Validation edge cases | Comprehensive type checking |

## Next Steps
- Phase 04: UI Components
