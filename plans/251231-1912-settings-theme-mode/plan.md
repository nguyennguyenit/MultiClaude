# Implementation Plan: Settings - Theme & Light/Dark Mode

**Date:** 2025-12-31
**Status:** COMPLETED (2025-12-31)
**Brainstorm:** `plans/reports/brainstorm-251231-1912-settings-theme-light-dark-mode.md`

---

## Overview

Add Settings panel to MultiClaude sidebar with:
- Light/Dark/System mode toggle
- 7 color themes (matching Auto Claude)
- localStorage persistence
- Live preview

## Phases

| Phase | Description | Files | Status |
|-------|-------------|-------|--------|
| 1 | Types & Constants | 2 files | DONE (2025-12-31) |
| 2 | Settings Store | 1 file | DONE (2025-12-31) |
| 3 | CSS Theme Variables | 1 file | DONE (2025-12-31) |
| 4 | UI Components | 3 files | DONE (2025-12-31) |
| 5 | Integration | 2 files | DONE (2025-12-31) |

---

## Phase 1: Types & Constants

### 1.1 Update Types (`src/shared/types/index.ts`)

Add to existing file:

```typescript
// Theme types
export type ThemeMode = 'light' | 'dark' | 'system'
export type ColorTheme = 'default' | 'dusk' | 'lime' | 'ocean' | 'retro' | 'neo' | 'forest'

export interface ThemePreviewColors {
  bg: string
  accent: string
  darkBg: string
  darkAccent?: string
}

export interface ColorThemeDefinition {
  id: ColorTheme
  name: string
  description: string
  previewColors: ThemePreviewColors
}

export interface AppSettings {
  themeMode: ThemeMode
  colorTheme: ColorTheme
}
```

### 1.2 Create Theme Constants (`src/shared/constants/themes.ts`)

```typescript
import type { ColorThemeDefinition } from '../types'

export const COLOR_THEMES: ColorThemeDefinition[] = [
  {
    id: 'default',
    name: 'Default',
    description: 'Classic dark with pale yellow accent',
    previewColors: { bg: '#F2F2ED', accent: '#E6E7A3', darkBg: '#0B0B0F', darkAccent: '#E6E7A3' }
  },
  {
    id: 'dusk',
    name: 'Dusk',
    description: 'Warm variant with lighter dark mode',
    previewColors: { bg: '#F5F5F0', accent: '#E6E7A3', darkBg: '#131419', darkAccent: '#E6E7A3' }
  },
  {
    id: 'lime',
    name: 'Lime',
    description: 'Energetic lime with purple accents',
    previewColors: { bg: '#E8F5A3', accent: '#7C3AED', darkBg: '#0F0F1A' }
  },
  {
    id: 'ocean',
    name: 'Ocean',
    description: 'Calm, professional blue tones',
    previewColors: { bg: '#E0F2FE', accent: '#0284C7', darkBg: '#082F49' }
  },
  {
    id: 'retro',
    name: 'Retro',
    description: 'Warm, nostalgic amber vibes',
    previewColors: { bg: '#FEF3C7', accent: '#D97706', darkBg: '#1C1917' }
  },
  {
    id: 'neo',
    name: 'Neo',
    description: 'Modern cyberpunk pink/magenta',
    previewColors: { bg: '#FDF4FF', accent: '#D946EF', darkBg: '#0F0720' }
  },
  {
    id: 'forest',
    name: 'Forest',
    description: 'Natural, earthy green tones',
    previewColors: { bg: '#DCFCE7', accent: '#16A34A', darkBg: '#052E16' }
  }
]

export const DEFAULT_SETTINGS: AppSettings = {
  themeMode: 'system',
  colorTheme: 'default'
}
```

### 1.3 Update Constants Index (`src/shared/constants/index.ts`)

```typescript
export * from './ipc-channels'
export * from './themes'
```

---

## Phase 2: Settings Store

### 2.1 Create Settings Store (`src/renderer/stores/settings-store.ts`)

```typescript
import { create } from 'zustand'
import type { AppSettings, ThemeMode, ColorTheme } from '@shared/types'
import { DEFAULT_SETTINGS } from '@shared/constants'

const STORAGE_KEY = 'multiclaude-settings'

interface SettingsState {
  settings: AppSettings
  setThemeMode: (mode: ThemeMode) => void
  setColorTheme: (theme: ColorTheme) => void
  loadSettings: () => void
}

function loadFromStorage(): AppSettings {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored) {
      return { ...DEFAULT_SETTINGS, ...JSON.parse(stored) }
    }
  } catch {
    // Ignore parse errors
  }
  return DEFAULT_SETTINGS
}

function saveToStorage(settings: AppSettings): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings))
  } catch {
    // Ignore storage errors
  }
}

export const useSettingsStore = create<SettingsState>((set, get) => ({
  settings: DEFAULT_SETTINGS,

  setThemeMode: (mode) => {
    const newSettings = { ...get().settings, themeMode: mode }
    saveToStorage(newSettings)
    set({ settings: newSettings })
  },

  setColorTheme: (theme) => {
    const newSettings = { ...get().settings, colorTheme: theme }
    saveToStorage(newSettings)
    set({ settings: newSettings })
  },

  loadSettings: () => {
    set({ settings: loadFromStorage() })
  }
}))
```

### 2.2 Update Stores Index (`src/renderer/stores/index.ts`)

```typescript
export { useAppStore } from './app-store'
export { useSettingsStore } from './settings-store'
```

---

## Phase 3: CSS Theme Variables

### 3.1 Update Globals CSS (`src/renderer/styles/globals.css`)

Add after existing styles:

```css
/* ============================================
   Theme System - CSS Variables
   ============================================ */

:root {
  /* Base colors - will be overridden by theme classes */
  --mc-bg-primary: #1e1e1e;
  --mc-bg-secondary: #252526;
  --mc-bg-tertiary: #2d2d2d;
  --mc-bg-hover: #3c3c3c;
  --mc-bg-active: #37373d;
  --mc-text-primary: #d4d4d4;
  --mc-text-secondary: #9d9d9d;
  --mc-text-muted: #6b6b6b;
  --mc-border: #3c3c3c;
  --mc-accent: #E6E7A3;
  --mc-accent-hover: #f0f1b8;
}

/* Light Mode Base */
.light {
  --mc-bg-primary: #ffffff;
  --mc-bg-secondary: #f5f5f5;
  --mc-bg-tertiary: #ebebeb;
  --mc-bg-hover: #e0e0e0;
  --mc-bg-active: #d5d5d5;
  --mc-text-primary: #1e1e1e;
  --mc-text-secondary: #555555;
  --mc-text-muted: #888888;
  --mc-border: #e0e0e0;
}

/* Dark Mode Base (default) */
.dark {
  --mc-bg-primary: #1e1e1e;
  --mc-bg-secondary: #252526;
  --mc-bg-tertiary: #2d2d2d;
  --mc-bg-hover: #3c3c3c;
  --mc-bg-active: #37373d;
  --mc-text-primary: #d4d4d4;
  --mc-text-secondary: #9d9d9d;
  --mc-text-muted: #6b6b6b;
  --mc-border: #3c3c3c;
}

/* Theme: Default */
.theme-default.light { --mc-accent: #b8a900; --mc-bg-primary: #F2F2ED; }
.theme-default.dark { --mc-accent: #E6E7A3; --mc-bg-primary: #0B0B0F; }

/* Theme: Dusk */
.theme-dusk.light { --mc-accent: #b8a900; --mc-bg-primary: #F5F5F0; }
.theme-dusk.dark { --mc-accent: #E6E7A3; --mc-bg-primary: #131419; }

/* Theme: Lime */
.theme-lime.light { --mc-accent: #7C3AED; --mc-bg-primary: #E8F5A3; }
.theme-lime.dark { --mc-accent: #A855F7; --mc-bg-primary: #0F0F1A; }

/* Theme: Ocean */
.theme-ocean.light { --mc-accent: #0284C7; --mc-bg-primary: #E0F2FE; }
.theme-ocean.dark { --mc-accent: #38BDF8; --mc-bg-primary: #082F49; }

/* Theme: Retro */
.theme-retro.light { --mc-accent: #D97706; --mc-bg-primary: #FEF3C7; }
.theme-retro.dark { --mc-accent: #FBBF24; --mc-bg-primary: #1C1917; }

/* Theme: Neo */
.theme-neo.light { --mc-accent: #D946EF; --mc-bg-primary: #FDF4FF; }
.theme-neo.dark { --mc-accent: #E879F9; --mc-bg-primary: #0F0720; }

/* Theme: Forest */
.theme-forest.light { --mc-accent: #16A34A; --mc-bg-primary: #DCFCE7; }
.theme-forest.dark { --mc-accent: #4ADE80; --mc-bg-primary: #052E16; }
```

---

## Phase 4: UI Components

### 4.1 Create Theme Selector (`src/renderer/components/settings/theme-selector.tsx`)

```typescript
import { useSettingsStore } from '../../stores'
import { COLOR_THEMES } from '@shared/constants'
import type { ThemeMode, ColorTheme } from '@shared/types'

export function ThemeSelector() {
  const { settings, setThemeMode, setColorTheme } = useSettingsStore()

  const isDark = settings.themeMode === 'dark' ||
    (settings.themeMode === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches)

  return (
    <div className="space-y-4">
      {/* Mode Toggle */}
      <div>
        <div className="text-xs text-[var(--mc-text-muted)] uppercase mb-2">Appearance</div>
        <div className="grid grid-cols-3 gap-1">
          {(['system', 'light', 'dark'] as ThemeMode[]).map((mode) => (
            <button
              key={mode}
              onClick={() => setThemeMode(mode)}
              className={`
                flex flex-col items-center gap-1 p-2 rounded text-xs capitalize
                ${settings.themeMode === mode
                  ? 'bg-[var(--mc-accent)] text-[var(--mc-bg-primary)]'
                  : 'bg-[var(--mc-bg-hover)] hover:bg-[var(--mc-bg-active)] text-[var(--mc-text-primary)]'
                }
              `}
            >
              {mode === 'system' && <SystemIcon />}
              {mode === 'light' && <SunIcon />}
              {mode === 'dark' && <MoonIcon />}
              {mode}
            </button>
          ))}
        </div>
      </div>

      {/* Color Theme Grid */}
      <div>
        <div className="text-xs text-[var(--mc-text-muted)] uppercase mb-2">Color Theme</div>
        <div className="grid grid-cols-2 gap-2">
          {COLOR_THEMES.map((theme) => {
            const isSelected = settings.colorTheme === theme.id
            const bgColor = isDark ? theme.previewColors.darkBg : theme.previewColors.bg
            const accentColor = isDark
              ? (theme.previewColors.darkAccent || theme.previewColors.accent)
              : theme.previewColors.accent

            return (
              <button
                key={theme.id}
                onClick={() => setColorTheme(theme.id)}
                className={`
                  relative flex flex-col p-2 rounded text-left text-xs
                  ${isSelected
                    ? 'ring-2 ring-[var(--mc-accent)] bg-[var(--mc-bg-active)]'
                    : 'bg-[var(--mc-bg-hover)] hover:bg-[var(--mc-bg-active)]'
                  }
                `}
              >
                {/* Preview swatches */}
                <div className="flex gap-1 mb-1">
                  <div
                    className="w-4 h-4 rounded-full border border-[var(--mc-border)]"
                    style={{ backgroundColor: bgColor }}
                  />
                  <div
                    className="w-4 h-4 rounded-full border border-[var(--mc-border)]"
                    style={{ backgroundColor: accentColor }}
                  />
                </div>
                <span className="font-medium text-[var(--mc-text-primary)]">{theme.name}</span>
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}

// Simple inline icons
function SunIcon() {
  return (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <circle cx="12" cy="12" r="5" strokeWidth="2" />
      <path strokeWidth="2" d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
    </svg>
  )
}

function MoonIcon() {
  return (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeWidth="2" d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z" />
    </svg>
  )
}

function SystemIcon() {
  return (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <rect x="2" y="3" width="20" height="14" rx="2" strokeWidth="2" />
      <path strokeWidth="2" d="M8 21h8M12 17v4" />
    </svg>
  )
}
```

### 4.2 Create Settings Panel (`src/renderer/components/settings/settings-panel.tsx`)

```typescript
import { ThemeSelector } from './theme-selector'

interface SettingsPanelProps {
  onClose: () => void
}

export function SettingsPanel({ onClose }: SettingsPanelProps) {
  return (
    <div className="border-t border-[var(--mc-border)] bg-[var(--mc-bg-secondary)] p-3">
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm font-medium text-[var(--mc-text-primary)]">Settings</span>
        <button
          onClick={onClose}
          className="p-1 hover:bg-[var(--mc-bg-hover)] rounded"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
      <ThemeSelector />
    </div>
  )
}
```

### 4.3 Create Settings Index (`src/renderer/components/settings/index.ts`)

```typescript
export { SettingsPanel } from './settings-panel'
export { ThemeSelector } from './theme-selector'
```

---

## Phase 5: Integration

### 5.1 Update Sidebar (`src/renderer/components/sidebar/sidebar.tsx`)

Add at top of file:
```typescript
import { SettingsPanel } from '../settings'
```

Add state inside `Sidebar` component:
```typescript
const [showSettings, setShowSettings] = useState(false)
```

Replace the closing `</div>` of sidebar (before Git section) with:

```tsx
{/* Settings Section - Bottom */}
<div className="mt-auto">
  {showSettings && (
    <SettingsPanel onClose={() => setShowSettings(false)} />
  )}
  <div className="border-t border-[var(--mc-border)] p-2">
    <button
      onClick={() => setShowSettings(!showSettings)}
      className={`
        w-full flex items-center gap-2 px-2 py-2 rounded text-sm
        ${showSettings
          ? 'bg-[var(--mc-bg-active)] text-[var(--mc-accent)]'
          : 'hover:bg-[var(--mc-bg-hover)] text-[var(--mc-text-secondary)]'
        }
      `}
    >
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
          d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
      <span>Settings</span>
    </button>
  </div>
</div>
```

### 5.2 Update App.tsx (`src/renderer/App.tsx`)

Add import:
```typescript
import { useSettingsStore } from './stores'
```

Add theme effect inside `App` component:
```typescript
const { settings, loadSettings } = useSettingsStore()

// Load settings on mount
useEffect(() => {
  loadSettings()
}, [])

// Apply theme classes to document
useEffect(() => {
  const root = document.documentElement

  // Determine actual mode
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
  const isDark = settings.themeMode === 'dark' ||
    (settings.themeMode === 'system' && prefersDark)

  // Remove old classes
  root.classList.remove('light', 'dark')
  COLOR_THEMES.forEach(t => root.classList.remove(`theme-${t.id}`))

  // Apply new classes
  root.classList.add(isDark ? 'dark' : 'light')
  root.classList.add(`theme-${settings.colorTheme}`)
}, [settings.themeMode, settings.colorTheme])
```

Update root div classes:
```tsx
<div className="h-screen flex flex-col bg-[var(--mc-bg-primary)] text-[var(--mc-text-primary)]">
```

---

## File Changes Summary

| File | Action | Lines |
|------|--------|-------|
| `src/shared/types/index.ts` | MODIFY | +20 |
| `src/shared/constants/themes.ts` | CREATE | ~50 |
| `src/shared/constants/index.ts` | MODIFY | +1 |
| `src/renderer/stores/settings-store.ts` | CREATE | ~50 |
| `src/renderer/stores/index.ts` | MODIFY | +1 |
| `src/renderer/styles/globals.css` | MODIFY | +60 |
| `src/renderer/components/settings/theme-selector.tsx` | CREATE | ~100 |
| `src/renderer/components/settings/settings-panel.tsx` | CREATE | ~30 |
| `src/renderer/components/settings/index.ts` | CREATE | ~3 |
| `src/renderer/components/sidebar/sidebar.tsx` | MODIFY | +30 |
| `src/renderer/App.tsx` | MODIFY | +25 |

**Total: ~370 lines of code**

---

## Verification Checklist

- [x] Settings icon appears at bottom of sidebar
- [x] Clicking Settings opens/closes panel
- [x] System/Light/Dark mode buttons work
- [x] All 7 color themes selectable
- [x] Theme previews show correct colors
- [x] Theme changes apply instantly
- [x] Settings persist after page refresh
- [x] System preference detection works
- [x] No CSS conflicts with existing styles
