# Phase 1: Main Process Settings Store

## Context Links
- Parent plan: [plan.md](./plan.md)
- Pattern reference: `src/main/project/project-store.ts`
- Brainstorm: `plans/reports/brainstorm-260109-1830-settings-save-windows-bug.md`

## Overview
- **Priority:** P1
- **Status:** DONE (2026-01-09 20:52)
- **Description:** Create `SettingsStore` class in main process using electron-store for disk persistence

## Key Insights
- Follow existing `ProjectStore` pattern exactly
- electron-store persists to `%APPDATA%/multiclaude/` on Windows (reliable)
- Reuse `AppSettings` type from `@shared/types`
- Support test mode via `MULTICLAUDE_TEST_STORE_PATH` env var

## Requirements
- [x] Create SettingsStore class with get/set methods
- [x] Store persists to separate file (`multiclaude-settings.json`)
- [x] Support defaults from `DEFAULT_SETTINGS`
- [x] Test mode support for unit tests

## Architecture

```
src/main/settings/
├── settings-store.ts   # electron-store wrapper class
└── index.ts            # Module export
```

**SettingsStore Schema:**
```typescript
interface StoreSchema {
  settings: AppSettings
}
```

## Related Code Files

| Action | Path | Description |
|--------|------|-------------|
| CREATE | `src/main/settings/settings-store.ts` | electron-store based persistence |
| CREATE | `src/main/settings/index.ts` | Module exports |

## Implementation Steps

### Step 1: Create settings-store.ts
```typescript
// src/main/settings/settings-store.ts
import Store from 'electron-store'
import type { AppSettings } from '@shared/types'
import { DEFAULT_SETTINGS } from '@shared/constants'

interface StoreSchema {
  settings: AppSettings
}

export class SettingsStore {
  private store: Store<StoreSchema>

  constructor() {
    const cwd = process.env.MULTICLAUDE_TEST_STORE_PATH || undefined

    this.store = new Store<StoreSchema>({
      name: 'multiclaude-settings',
      cwd,
      defaults: {
        settings: DEFAULT_SETTINGS
      }
    })
  }

  getSettings(): AppSettings {
    return this.store.get('settings')
  }

  setSettings(settings: Partial<AppSettings>): AppSettings {
    const current = this.getSettings()
    const updated = { ...current, ...settings }
    this.store.set('settings', updated)
    return updated
  }

  resetSettings(): AppSettings {
    this.store.set('settings', DEFAULT_SETTINGS)
    return DEFAULT_SETTINGS
  }
}
```

### Step 2: Create index.ts
```typescript
// src/main/settings/index.ts
export { SettingsStore } from './settings-store'
```

### Step 3: Instantiate in main process
Add to `src/main/index.ts`:
```typescript
import { SettingsStore } from './settings'

const settingsStore = new SettingsStore()
// Export or pass to IPC handlers
```

## Todo List
- [x] Create `src/main/settings/settings-store.ts`
- [x] Create `src/main/settings/index.ts`
- [x] Import and instantiate in main process

## Success Criteria
- [x] SettingsStore class exists with get/set/reset methods
- [x] Uses separate store file (`multiclaude-settings.json`)
- [x] Follows ProjectStore pattern

## Risk Assessment
| Risk | Impact | Mitigation |
|------|--------|------------|
| Naming collision | Low | Use distinct file name |
| Test isolation | Low | Support test store path env var |

## Security Considerations
- No sensitive data in settings (just theme/shell prefs)
- File permissions handled by electron-store

## Next Steps
Proceed to Phase 2: IPC + Preload Layer
