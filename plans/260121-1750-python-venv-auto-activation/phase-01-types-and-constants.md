# Phase 01: Types & Constants

## Context
- Parent: [plan.md](./plan.md)
- Dependencies: None

## Overview
- **Priority**: P1
- **Status**: ⏳ Pending
- **Effort**: 15m

Add type definitions and default settings for Python venv auto-activation feature.

## Requirements

### Functional
- FR-01: Add `autoActivatePythonVenv` boolean setting to AppSettings
- FR-02: Add optional `pythonVenv` config to Project interface

### Non-Functional
- NFR-01: Backward compatible - existing settings must continue working
- NFR-02: Default to `true` for new installations

## Architecture

```
AppSettings {
  ...existing,
  autoActivatePythonVenv: boolean  // NEW: Global toggle
}

Project {
  ...existing,
  pythonVenv?: {                   // NEW: Per-project override
    path: string                   // Relative path like ".venv"
    autoActivate: boolean          // Override global setting
  }
}
```

## Related Code Files

### Modify
- `src/shared/types/index.ts` - Add pythonVenv to Project, autoActivatePythonVenv to AppSettings
- `src/shared/constants/themes.ts` - Update DEFAULT_SETTINGS

## Implementation Steps

1. **Update AppSettings interface** (`src/shared/types/index.ts:202-213`)
   ```typescript
   export interface AppSettings {
     // ...existing fields
     autoActivatePythonVenv: boolean  // Add this
   }
   ```

2. **Add PythonVenvConfig interface** (`src/shared/types/index.ts`)
   ```typescript
   export interface PythonVenvConfig {
     path: string           // Relative path to venv (e.g., ".venv")
     autoActivate: boolean  // Per-project override
   }
   ```

3. **Update Project interface** (`src/shared/types/index.ts:25-32`)
   ```typescript
   export interface Project {
     // ...existing fields
     pythonVenv?: PythonVenvConfig  // Add this (optional)
   }
   ```

4. **Update DEFAULT_SETTINGS** (`src/shared/constants/themes.ts:125-138`)
   ```typescript
   export const DEFAULT_SETTINGS: AppSettings = {
     // ...existing fields
     autoActivatePythonVenv: true  // Add this
   }
   ```

## Todo List
- [ ] Add PythonVenvConfig interface
- [ ] Add pythonVenv to Project interface
- [ ] Add autoActivatePythonVenv to AppSettings
- [ ] Update DEFAULT_SETTINGS with default value

## Success Criteria
- [ ] TypeScript compiles without errors
- [ ] DEFAULT_SETTINGS includes new field
- [ ] Types are exported correctly

## Risk Assessment
| Risk | Impact | Mitigation |
|------|--------|------------|
| Breaking change to Project | Low | Field is optional with `?` |
| Settings migration | Low | DEFAULT_SETTINGS provides fallback |

## Security Considerations
- None - type definitions only

## Next Steps
→ Phase 02: Venv Detector Module
