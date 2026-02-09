# Phase 4: Integration & Cleanup

## Context

- Plan: `plans/260104-0431-ui-redesign-phase4-settings-modal/plan.md`
- Depends: Phases 1-3

## Overview

- **Priority**: P1
- **Status**: Pending
- **Effort**: 1h

Integrate Settings Modal into app, add trigger from User Account Card, remove inline panel.

## Requirements

### Integration Tasks
1. Add SettingsModal to App.tsx
2. Add trigger from User Account Card (Phase 1 component)
3. Wire up modal state to store
4. Remove inline SettingsPanel from sidebar
5. Update exports

### Layout Comparison

**Before (inline panel in sidebar):**
```
[ Sidebar ]
  [...]
  [ Settings Panel (inline) ]
```

**After (modal popup):**
```
[ User Account Card ] → click settings icon → [ Settings Modal ]
```

## Related Code Files

### Modify
| File | Changes |
|------|---------|
| `src/renderer/App.tsx` | Add SettingsModal |
| `src/renderer/components/sidebar/sidebar.tsx` | Remove inline settings |
| `src/renderer/components/sidebar/user-account-card.tsx` | Add settings trigger |
| `src/renderer/components/settings/index.ts` | Update exports |

### Potentially Remove
| File | Reason |
|------|--------|
| Inline SettingsPanel usage | Replaced by modal |

## Implementation Steps

### Step 1: Update User Account Card

```tsx
// user-account-card.tsx - add settings icon trigger
import { useSettingsStore } from '../../stores'

export function UserAccountCard() {
  const { setSettingsModalOpen } = useSettingsStore()

  return (
    <div className="...">
      {/* ... existing content ... */}
      <button
        onClick={() => setSettingsModalOpen(true)}
        className="p-1 hover:bg-[var(--mc-bg-hover)] rounded"
        title="Settings"
      >
        ⚙️
      </button>
    </div>
  )
}
```

### Step 2: Add Modal to App.tsx

```tsx
// App.tsx
import { SettingsModal } from './components/settings/settings-modal'
import { useSettingsStore } from './stores'

function App() {
  const { settingsModalOpen, setSettingsModalOpen } = useSettingsStore()

  return (
    <>
      {/* ... existing app content ... */}

      <SettingsModal
        isOpen={settingsModalOpen}
        onClose={() => setSettingsModalOpen(false)}
      />
    </>
  )
}
```

### Step 3: Remove Inline Settings

```tsx
// sidebar.tsx - remove SettingsPanel
// Before:
{showSettings && <SettingsPanel onClose={() => setShowSettings(false)} />}

// After:
// Remove this entirely - settings now in modal
```

### Step 4: Update Exports

```tsx
// src/renderer/components/settings/index.ts
export { SettingsModal } from './settings-modal'
export { SettingsSidebar } from './settings-sidebar'
export { ThemeSelector } from './theme-selector'
export { TerminalSettings } from './terminal-settings'
export { NotificationSettings } from './notification-settings'
// Keep config modals
export { TelegramConfigModal } from './telegram-config-modal'
export { DiscordConfigModal } from './discord-config-modal'
```

### Step 5: Test Full Workflow

Test checklist:
- [ ] Click settings icon in User Account Card → modal opens
- [ ] ESC key closes modal
- [ ] Click backdrop closes modal
- [ ] Tab navigation works (Appearance/Terminals/Notifications)
- [ ] All settings changes persist
- [ ] Cancel button closes without saving
- [ ] Save button closes with saving
- [ ] No inline settings panel in sidebar

## Todo List

- [ ] Add settings trigger to User Account Card
- [ ] Add SettingsModal to App.tsx
- [ ] Wire up modal state
- [ ] Remove inline SettingsPanel from sidebar
- [ ] Update exports in index.ts
- [ ] Test modal open/close
- [ ] Test all tabs
- [ ] Test settings persistence
- [ ] Remove dead code

## Success Criteria

- [ ] Modal triggered from User Account Card
- [ ] No inline settings in sidebar
- [ ] All 3 tabs work correctly
- [ ] Settings persist on save
- [ ] No console errors
- [ ] Clean integration

## Risk Assessment

| Risk | Impact | Mitigation |
|------|--------|------------|
| Breaking settings persistence | High | Test thoroughly |
| Missing component exports | Low | Verify all imports |

## Security Considerations

N/A - UI reorganization only.

## Next Steps

Phase 4 Settings Modal complete. Proceed to implementation or Phase 5 Issues/PRs.
