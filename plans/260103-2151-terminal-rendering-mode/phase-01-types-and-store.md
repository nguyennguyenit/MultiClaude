# Phase 1: Types & Store Foundation

## Objective

Add `TerminalRenderMode` type and extend settings infrastructure.

## Tasks

### 1.1 Add Type Definition

**File**: `src/shared/types/index.ts`

Add after line 112 (after `ColorTheme` type):

```typescript
// Terminal rendering mode for performance optimization
export type TerminalRenderMode = 'performance' | 'balanced' | 'quality'
```

Extend `AppSettings` interface (line 128-131):

```typescript
export interface AppSettings {
  themeMode: ThemeMode
  colorTheme: ColorTheme
  terminalRenderMode: TerminalRenderMode  // NEW
}
```

### 1.2 Update Default Settings

**File**: `src/shared/constants/themes.ts`

Update `DEFAULT_SETTINGS` (line 48-51):

```typescript
export const DEFAULT_SETTINGS: AppSettings = {
  themeMode: 'system',
  colorTheme: 'default',
  terminalRenderMode: 'balanced'  // NEW - default to balanced mode
}
```

### 1.3 Add Settings Store Setter

**File**: `src/renderer/stores/settings-store.ts`

Add import for new type (line 2):

```typescript
import type { AppSettings, ThemeMode, ColorTheme, TerminalRenderMode } from '@shared/types'
```

Add to `SettingsState` interface (after line 12):

```typescript
setTerminalRenderMode: (mode: TerminalRenderMode) => void
```

Add setter implementation (after line 50):

```typescript
setTerminalRenderMode: (mode) => {
  const newSettings = { ...get().settings, terminalRenderMode: mode }
  saveToStorage(newSettings)
  set({ settings: newSettings })
},
```

## Verification

After Phase 1:
- [ ] TypeScript compiles without errors
- [ ] `useSettingsStore.getState().settings.terminalRenderMode` returns `'balanced'`
- [ ] Setting persists in localStorage after `setTerminalRenderMode()` call

## Code Diff Preview

### src/shared/types/index.ts

```diff
 // Theme types
 export type ThemeMode = 'light' | 'dark' | 'system'
 export type ColorTheme = 'default' | 'dusk' | 'lime' | 'ocean' | 'retro' | 'neo' | 'forest'
+// Terminal rendering mode for performance optimization
+export type TerminalRenderMode = 'performance' | 'balanced' | 'quality'

 ...

 export interface AppSettings {
   themeMode: ThemeMode
   colorTheme: ColorTheme
+  terminalRenderMode: TerminalRenderMode
 }
```

### src/shared/constants/themes.ts

```diff
 export const DEFAULT_SETTINGS: AppSettings = {
   themeMode: 'system',
-  colorTheme: 'default'
+  colorTheme: 'default',
+  terminalRenderMode: 'balanced'
 }
```

### src/renderer/stores/settings-store.ts

```diff
-import type { AppSettings, ThemeMode, ColorTheme } from '@shared/types'
+import type { AppSettings, ThemeMode, ColorTheme, TerminalRenderMode } from '@shared/types'

 interface SettingsState {
   settings: AppSettings
   gitPanelOpen: boolean
   setThemeMode: (mode: ThemeMode) => void
   setColorTheme: (theme: ColorTheme) => void
+  setTerminalRenderMode: (mode: TerminalRenderMode) => void
   setGitPanelOpen: (open: boolean) => void
   loadSettings: () => void
 }

 ...

   setColorTheme: (theme) => {
     const newSettings = { ...get().settings, colorTheme: theme }
     saveToStorage(newSettings)
     set({ settings: newSettings })
   },

+  setTerminalRenderMode: (mode) => {
+    const newSettings = { ...get().settings, terminalRenderMode: mode }
+    saveToStorage(newSettings)
+    set({ settings: newSettings })
+  },
```

---

*Phase 1 of 4*
