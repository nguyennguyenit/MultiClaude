# Phase 3: Renderer Store Migration

## Context Links
- Parent plan: [plan.md](./plan.md)
- Previous: [phase-02](./phase-02-ipc-preload-layer.md)
- Current store: `src/renderer/stores/settings-store.ts`
- Settings modal: `src/renderer/components/settings/settings-modal.tsx`

## Overview
- **Priority:** P1
- **Status:** Pending
- **Description:** Migrate to explicit save flow - preview changes, only persist on Save button

## Key Insights
- **Current:** Auto-save on every change (no undo possible)
- **New:** Preview changes → Save explicitly OR Cancel to revert
- Need two states: `savedSettings` (persisted) and `pendingSettings` (preview)
- Theme preview should apply immediately for UX, but revert on cancel

## Requirements
- [ ] Separate saved vs pending settings state
- [ ] Preview changes without persisting
- [ ] Revert to saved settings on Cancel/X
- [ ] Only persist on explicit Save button click
- [ ] Load saved settings from main process on startup

## Architecture

**State Structure:**
```typescript
interface SettingsState {
  savedSettings: AppSettings      // Persisted to disk
  pendingSettings: AppSettings    // Preview/editing state
  hasUnsavedChanges: boolean      // Track if pending != saved
  // ...
}
```

**Flow:**
```
Open Modal → pendingSettings = savedSettings (copy)
Change Theme → pendingSettings updated + UI preview
Click Save → savedSettings = pendingSettings + IPC persist
Click Cancel → pendingSettings = savedSettings (revert)
```

## Related Code Files

| Action | Path | Description |
|--------|------|-------------|
| MODIFY | `src/renderer/stores/settings-store.ts` | Add pending/saved separation |
| MODIFY | `src/renderer/components/settings/settings-modal.tsx` | Wire Save/Cancel logic |

## Implementation Steps

### Step 1: Update settings-store.ts

```typescript
import { create } from 'zustand'
import type { AppSettings, ThemeMode, ColorTheme, ... } from '@shared/types'
import { DEFAULT_SETTINGS } from '@shared/constants'

const STORAGE_KEY = 'multiclaude-settings' // For migration check

interface SettingsState {
  // Persisted settings (source of truth)
  savedSettings: AppSettings
  // Pending/preview settings (edited but not saved)
  pendingSettings: AppSettings
  // Track unsaved changes
  hasUnsavedChanges: boolean
  // UI state (not persisted)
  wslInfo: WslInfo | null
  gitPanelOpen: boolean
  settingsModalOpen: boolean

  // Pending setters (preview only, no persist)
  setThemeMode: (mode: ThemeMode) => void
  setColorTheme: (theme: ColorTheme) => void
  setGlassmorphismEnabled: (enabled: boolean) => void
  setTerminalLimit: (limit: TerminalLimit) => void
  setTerminalRenderMode: (mode: TerminalRenderMode) => void
  setWindowsShell: (shell: WindowsShell) => void

  // Actions
  saveSettings: () => Promise<void>        // Persist pending → saved
  cancelSettings: () => void               // Revert pending → saved
  loadSettings: () => Promise<void>        // Load from disk on startup

  // Helpers
  getTerminalLimitValue: () => number
  setGitPanelOpen: (open: boolean) => void
  setSettingsModalOpen: (open: boolean) => void
  detectWsl: () => Promise<void>
}

export const useSettingsStore = create<SettingsState>((set, get) => ({
  savedSettings: DEFAULT_SETTINGS,
  pendingSettings: DEFAULT_SETTINGS,
  hasUnsavedChanges: false,
  wslInfo: null,
  gitPanelOpen: false,
  settingsModalOpen: false,

  // Pending setters - update preview only
  setThemeMode: (mode) => {
    const pending = { ...get().pendingSettings, themeMode: mode }
    set({
      pendingSettings: pending,
      hasUnsavedChanges: JSON.stringify(pending) !== JSON.stringify(get().savedSettings)
    })
  },

  setColorTheme: (theme) => {
    const pending = { ...get().pendingSettings, colorTheme: theme }
    set({
      pendingSettings: pending,
      hasUnsavedChanges: JSON.stringify(pending) !== JSON.stringify(get().savedSettings)
    })
  },

  setGlassmorphismEnabled: (enabled) => {
    const pending = { ...get().pendingSettings, glassmorphismEnabled: enabled }
    set({
      pendingSettings: pending,
      hasUnsavedChanges: JSON.stringify(pending) !== JSON.stringify(get().savedSettings)
    })
  },

  setTerminalLimit: (limit) => {
    const pending = { ...get().pendingSettings, terminalLimit: limit }
    set({
      pendingSettings: pending,
      hasUnsavedChanges: JSON.stringify(pending) !== JSON.stringify(get().savedSettings)
    })
  },

  setTerminalRenderMode: (mode) => {
    const pending = { ...get().pendingSettings, terminalRenderMode: mode }
    set({
      pendingSettings: pending,
      hasUnsavedChanges: JSON.stringify(pending) !== JSON.stringify(get().savedSettings)
    })
  },

  setWindowsShell: (shell) => {
    const pending = { ...get().pendingSettings, windowsShell: shell }
    set({
      pendingSettings: pending,
      hasUnsavedChanges: JSON.stringify(pending) !== JSON.stringify(get().savedSettings)
    })
  },

  // Save: persist pending to disk, update saved state
  saveSettings: async () => {
    const pending = get().pendingSettings
    try {
      await window.electron.settings.set(pending)
      set({
        savedSettings: pending,
        hasUnsavedChanges: false
      })
    } catch (err) {
      console.error('Failed to save settings:', err)
      throw err
    }
  },

  // Cancel: revert pending to saved
  cancelSettings: () => {
    set({
      pendingSettings: { ...get().savedSettings },
      hasUnsavedChanges: false
    })
  },

  // Load from disk on startup
  loadSettings: async () => {
    try {
      const settings = await window.electron.settings.get()
      set({
        savedSettings: settings,
        pendingSettings: settings,
        hasUnsavedChanges: false
      })

      // One-time migration from localStorage
      const oldData = localStorage.getItem(STORAGE_KEY)
      if (oldData) {
        try {
          const parsed = JSON.parse(oldData)
          const merged = { ...settings, ...parsed }
          await window.electron.settings.set(merged)
          set({
            savedSettings: merged,
            pendingSettings: merged
          })
          localStorage.removeItem(STORAGE_KEY)
        } catch {
          // Ignore migration errors
        }
      }
    } catch {
      set({
        savedSettings: DEFAULT_SETTINGS,
        pendingSettings: DEFAULT_SETTINGS
      })
    }
  },

  getTerminalLimitValue: () => {
    const { terminalLimit } = get().pendingSettings
    if (!terminalLimit) return 9
    if (terminalLimit.preset === 'custom') {
      return terminalLimit.customValue ?? 9
    }
    return terminalLimit.preset
  },

  setGitPanelOpen: (open) => set({ gitPanelOpen: open }),

  setSettingsModalOpen: (open) => {
    if (open) {
      // Reset pending to saved when opening modal
      set({
        settingsModalOpen: true,
        pendingSettings: { ...get().savedSettings },
        hasUnsavedChanges: false
      })
    } else {
      set({ settingsModalOpen: false })
    }
  },

  detectWsl: async () => {
    if (typeof window !== 'undefined' && window.electron?.terminal?.detectWsl) {
      try {
        const info = await window.electron.terminal.detectWsl()
        if (!info) return
        set({ wslInfo: info })

        const currentShell = get().pendingSettings.windowsShell
        if (currentShell?.type === 'wsl' && info.available) {
          const distroExists = info.distros.some(d => d.name === currentShell.distro)
          if (!distroExists) {
            const pending = { ...get().pendingSettings, windowsShell: { type: 'cmd' as const } }
            set({ pendingSettings: pending })
          }
        }
      } catch {
        set({ wslInfo: { available: false, distros: [] } })
      }
    }
  }
}))
```

### Step 2: Update components to use pendingSettings

Components that display settings should read from `pendingSettings` for preview:

```typescript
// In theme-selector.tsx or similar
const { pendingSettings, setColorTheme } = useSettingsStore()
const currentTheme = pendingSettings.colorTheme  // Use pending for preview
```

### Step 3: Update settings-modal.tsx

```typescript
// settings-modal.tsx
import { useSettingsStore } from '@/stores'

export function SettingsModal({ onClose }: Props) {
  const { saveSettings, cancelSettings, hasUnsavedChanges } = useSettingsStore()

  const handleSave = async () => {
    await saveSettings()
    onClose()
  }

  const handleCancel = () => {
    cancelSettings()
    onClose()
  }

  return (
    <div>
      {/* Settings content */}

      <div className="footer">
        <button onClick={handleCancel}>
          Cancel
        </button>
        <button
          onClick={handleSave}
          disabled={!hasUnsavedChanges}
        >
          Save Settings
        </button>
      </div>
    </div>
  )
}
```

### Step 4: Handle X button as Cancel

Ensure clicking X reverts changes:
```typescript
// When X button or overlay clicked
const handleClose = () => {
  cancelSettings()  // Revert to saved
  onClose()
}
```

## Todo List
- [ ] Add `savedSettings` and `pendingSettings` to store
- [ ] Add `hasUnsavedChanges` computed state
- [ ] Implement `saveSettings()` - persist pending
- [ ] Implement `cancelSettings()` - revert pending to saved
- [ ] Update setters to modify pending only
- [ ] Reset pending to saved when modal opens
- [ ] Update modal with Save/Cancel handlers
- [ ] Ensure X button calls cancelSettings

## Success Criteria
- [ ] Changing theme shows preview immediately
- [ ] Clicking Cancel/X reverts to previous settings
- [ ] Clicking Save persists changes to disk
- [ ] App restart loads saved settings correctly

## Risk Assessment
| Risk | Impact | Mitigation |
|------|--------|------------|
| UX confusion | Medium | Clear button labels, disable Save when no changes |
| Theme flash on cancel | Low | Revert is instant |
| Unsaved changes lost | Expected | This is the intended behavior |

## Security Considerations
- No change from previous phases

## Next Steps
Proceed to Phase 4: Testing + Validation
