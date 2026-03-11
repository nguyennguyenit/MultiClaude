# Phase 04: Settings Store Updates

## Context
- Parent: [plan.md](./plan.md)
- Dependencies: Phase 01 (Types)

## Overview
- **Priority**: P2
- **Status**: ⏳ Pending
- **Effort**: 30m

Update settings stores to handle the new `autoActivatePythonVenv` setting.

## Requirements

### Functional
- FR-01: Validate autoActivatePythonVenv as boolean
- FR-02: Add setter in renderer store
- FR-03: Include in equality check

### Non-Functional
- NFR-01: Backward compatible with existing settings
- NFR-02: Follow existing validation patterns

## Architecture

```
Main Process                     Renderer
+------------------+            +------------------+
| SettingsStore    |    IPC     | useSettingsStore |
| - validate       | <--------> | - pending state  |
| - persist        |            | - setAutoVenv    |
+------------------+            +------------------+
```

## Related Code Files

### Modify
- `src/main/settings/settings-store.ts` - Add validation
- `src/renderer/stores/settings-store.ts` - Add setter and equality check

## Implementation Steps

1. **Add validation** (`src/main/settings/settings-store.ts:47-52`)

   After `glassmorphismEnabled` validation block:
   ```typescript
   // Validate autoActivatePythonVenv
   if (settings.autoActivatePythonVenv !== undefined) {
     validated.autoActivatePythonVenv = typeof settings.autoActivatePythonVenv === 'boolean'
       ? settings.autoActivatePythonVenv
       : defaults.autoActivatePythonVenv
   }
   ```

2. **Update equality check** (`src/renderer/stores/settings-store.ts:68-104`)

   Add after line 74:
   ```typescript
   if (a.autoActivatePythonVenv !== b.autoActivatePythonVenv) return false
   ```

3. **Add setter** (`src/renderer/stores/settings-store.ts`)

   In interface (around line 50):
   ```typescript
   setAutoActivatePythonVenv: (enabled: boolean) => void
   ```

   In store implementation (after setTerminalStyleOptions):
   ```typescript
   setAutoActivatePythonVenv: (enabled) => {
     const pending = { ...get().pendingSettings, autoActivatePythonVenv: enabled }
     set({
       pendingSettings: pending,
       hasUnsavedChanges: !areSettingsEqual(pending, get().savedSettings)
     })
   },
   ```

## Todo List
- [ ] Add validation in main settings store
- [ ] Add equality check for new field
- [ ] Add setter method in renderer store
- [ ] Verify TypeScript compiles

## Success Criteria
- [ ] Setting persists correctly to disk
- [ ] Invalid values fall back to default
- [ ] hasUnsavedChanges tracks new field

## Risk Assessment
| Risk | Impact | Mitigation |
|------|--------|------------|
| Missing validation | Low | Follows existing pattern |
| Store migration | None | Optional field with default |

## Security Considerations
- Boolean validation prevents type confusion

## Next Steps
→ Implementation complete. Future: Add Settings UI toggle.

## Future Enhancements (Out of Scope)
- Settings UI toggle in Terminal settings tab
- Per-project venv path configuration
- Conda environment support
- Node.js nvm auto-activation
