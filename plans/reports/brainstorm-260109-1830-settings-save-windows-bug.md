# Brainstorm: Windows Settings Save Error - Root Cause Analysis

**Date:** 2026-01-09
**Status:** Complete
**Issue:** Settings don't persist after app restart on Windows

---

## Problem Statement

Windows users experience settings not being saved when:
1. User changes Color Theme (e.g., Default → Retro)
2. User changes Shell preference (e.g., Command Prompt → PowerShell)
3. User clicks "Save Settings" button
4. User closes and reopens app
5. **Result:** All settings revert to defaults

Video evidence: `new-feature/bugs/setting-save-error.mp4`

---

## Root Cause Analysis

### Primary Issue: localStorage vs electron-store Persistence

The app uses **two different persistence mechanisms**:

| Data Type | Storage Method | Location | Persistence |
|-----------|---------------|----------|-------------|
| Projects, Sessions, Terminal Layouts | `electron-store` | Main process → Disk file | **Works** |
| App Settings (Theme, Shell, etc.) | `localStorage` | Renderer process → Browser storage | **Fails on Windows** |

### Code Evidence

**ProjectStore (Works)** - `src/main/project/project-store.ts:1-28`:
```typescript
import Store from 'electron-store'
// ...
this.store = new Store<StoreSchema>({
  name: 'multiclaude-data',
  // Persists to: %APPDATA%/multiclaude/multiclaude-data.json
})
```

**SettingsStore (Broken)** - `src/renderer/stores/settings-store.ts:25-43`:
```typescript
function loadFromStorage(): AppSettings {
  const stored = localStorage.getItem(STORAGE_KEY)  // ❌ Web storage
  // ...
}

function saveToStorage(settings: AppSettings): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(settings))  // ❌ Ephemeral
}
```

### Why localStorage Fails on Windows

1. **Electron's localStorage is Chromium web storage** - designed for web apps, not desktop persistence
2. **Storage location varies** - based on app data directory, packaging method
3. **Windows sandboxing** - stricter storage policies than macOS/Linux
4. **App restart context** - localStorage context may differ between sessions
5. **Installation path issues** - Windows NTFS permissions can affect Chromium storage

### Secondary Issue: Misleading "Save Settings" Button

`src/renderer/components/settings/settings-modal.tsx:78-85`:
```typescript
<button
  data-testid="settings-save-button"
  onClick={onClose}  // ❌ Only closes modal, doesn't save!
  // ...
>
  Save Settings
</button>
```

**Note:** Button is cosmetic - settings auto-save on each change via store setters. The real problem is the storage backend, not the button.

---

## Current Architecture (Broken)

```
┌─────────────────────────────────────────────────────┐
│ Renderer Process                                     │
│                                                      │
│  User Action → setColorTheme() → localStorage.set() │
│                                      ↓              │
│                              Browser Storage        │
│                              (Ephemeral on Windows) │
└─────────────────────────────────────────────────────┘
                    ❌ NOT PERSISTED
```

---

## Recommended Solution Architecture

```
┌─────────────────────────────────────────────────────┐
│ Renderer Process                                     │
│                                                      │
│  User Action → setColorTheme()                      │
│                     ↓                                │
│           window.electron.settings.save()           │
│                     ↓                                │
│                 IPC Channel                          │
└─────────────────────────────────────────────────────┘
                     ↓
┌─────────────────────────────────────────────────────┐
│ Main Process                                         │
│                                                      │
│  IPC Handler → SettingsStore → electron-store.set() │
│                                      ↓              │
│                            Disk File                │
│                   (%APPDATA%/multiclaude/settings)  │
└─────────────────────────────────────────────────────┘
                    ✅ PERSISTED
```

---

## Implementation Approach

### Option 1: Main Process Settings Store (Recommended)

**Pros:**
- Consistent with existing `ProjectStore` pattern
- electron-store proven reliable cross-platform
- Single source of truth in main process

**Cons:**
- Requires IPC for every settings operation
- Slight latency (negligible)

**Implementation:**
1. Create `SettingsStore` class in `src/main/settings/settings-store.ts`
2. Add IPC handlers in `src/main/ipc/handlers.ts`
3. Expose via preload script
4. Update renderer `useSettingsStore` to use IPC

### Option 2: Hybrid Persistence

Use localStorage as cache + sync to electron-store via IPC.

**Pros:**
- Faster UI updates
- Fallback if main process unavailable

**Cons:**
- Complex sync logic
- Potential inconsistencies

---

## Affected Files

### Must Modify:
1. `src/renderer/stores/settings-store.ts` - Switch from localStorage to IPC
2. `src/main/ipc/handlers.ts` - Add settings IPC handlers
3. `src/preload/index.ts` - Expose settings API

### Must Create:
1. `src/main/settings/settings-store.ts` - electron-store based persistence
2. `src/main/settings/index.ts` - Export module

### Optional (UX Improvement):
1. `src/renderer/components/settings/settings-modal.tsx` - Remove misleading "Save Settings" button or add toast feedback

---

## Success Criteria

1. Settings persist after app restart on Windows
2. Settings persist after app restart on macOS/Linux (regression test)
3. Smooth UX - no perceivable delay when changing settings
4. Consistent architecture with existing ProjectStore pattern

---

## Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Migration breaks existing settings | High | Check for old localStorage data, migrate once |
| IPC latency affects UX | Low | Optimistic UI updates + async persist |
| Type mismatches | Medium | Reuse existing `AppSettings` type from shared |

---

## Unresolved Questions

1. Should old localStorage settings be migrated to new store? (Recommended: Yes, one-time migration)
2. Should "Save Settings" button be removed entirely since auto-save is the pattern?

---

## Next Steps

1. **Implement Option 1** - Main Process Settings Store
2. **Test on Windows** - Verify persistence after restart
3. **Regression test** on macOS/Linux

---

## References

- Video: `new-feature/bugs/setting-save-error.mp4`
- Working pattern: `src/main/project/project-store.ts`
- Broken store: `src/renderer/stores/settings-store.ts`
- electron-store docs: https://github.com/sindresorhus/electron-store
