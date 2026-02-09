# Theming & Appearance System Analysis

**Date:** 2026-01-15
**Scope:** Complete theming, appearance settings, and styling architecture

---

## Executive Summary

MultiClaude uses **CSS variables + Tailwind CSS** theming system with:
- 10 color themes (Default, Dusk, Lime, Ocean, Retro, Neo, Forest, Neon Cyber, Pro Dark, Vibrant)
- 3 appearance modes (Light, Dark, System)
- Live preview in settings modal with explicit Save/Cancel flow
- Separate terminal theming via xterm.js ITheme objects
- Settings persisted to disk via electron-store

---

## Core Theme Files

### 1. Theme Configuration & Constants

**`/home/plateau/Desktop/Claude Code/MultiClaude/src/shared/constants/themes.ts`**
- Defines `COLOR_THEMES` array with 10 theme definitions
- Each theme has: id, name, description, previewColors (bg/accent for light/dark)
- `DEFAULT_SETTINGS` object with initial app configuration
- Theme IDs: `default | dusk | lime | ocean | retro | neo | forest | neon-cyber | pro-dark | vibrant`

**`/home/plateau/Desktop/Claude Code/MultiClaude/src/shared/constants/terminal-themes.ts`**
- Defines `TERMINAL_THEMES` mapping each ColorTheme × Mode to xterm.js ITheme
- Separate themes for terminal rendering (background, foreground, cursor, ANSI colors)
- `getTerminalTheme(colorTheme, isDark)` helper function
- Ensures terminal colors match app theme

### 2. CSS Styling System

**`/home/plateau/Desktop/Claude Code/MultiClaude/src/renderer/styles/globals.css`**
- **Lines 77-96:** CSS variable definitions in `:root`
- **Lines 98-123:** Light/dark mode base classes (`.light`, `.dark`)
- **Lines 126-163:** Theme-specific overrides (`.theme-default.light`, `.theme-ocean.dark`, etc.)
- Variables used throughout:
  - `--mc-bg-primary/secondary/tertiary` - Background layers
  - `--mc-bg-hover/active` - Interactive states
  - `--mc-text-primary/secondary/muted` - Text hierarchy
  - `--mc-border` - Border color
  - `--mc-accent` - Primary accent color (changes per theme)
  - `--mc-backdrop` - Modal overlay

**`/home/plateau/Desktop/Claude Code/MultiClaude/tailwind.config.js`**
- Standard Tailwind config with terminal color extensions
- Content paths: `./index.html`, `./src/renderer/**/*.{js,ts,jsx,tsx}`
- Minimal custom configuration (relies on CSS variables)

---

## Settings Architecture

### 3. Settings State Management

**`/home/plateau/Desktop/Claude Code/MultiClaude/src/renderer/stores/settings-store.ts`** (263 lines)
- **Zustand store** with dual-state architecture:
  - `savedSettings`: Persisted source of truth from disk
  - `pendingSettings`: Working copy for live preview
  - `settings`: Backward-compatible alias → `pendingSettings`
- **Key Actions:**
  - `setThemeMode(mode)` - Updates pending theme mode
  - `setColorTheme(theme)` - Updates pending color theme
  - `saveSettings()` - Persists pending → saved → disk
  - `cancelSettings()` - Reverts pending → saved
  - `loadSettings()` - Loads from disk on startup
- **Change Tracking:**
  - `hasUnsavedChanges` - Computed via `areSettingsEqual()` deep comparison
  - Enables Save button only when changes exist
- **LocalStorage Migration:** One-time migration from old localStorage to electron-store

**`/home/plateau/Desktop/Claude Code/MultiClaude/src/main/settings/settings-store.ts`** (137 lines)
- **Main process** settings persistence via electron-store
- Stored at: `%APPDATA%/multiclaude/multiclaude-settings.json` (Windows)
- **Validation:** `validateSettings()` sanitizes all inputs
  - Validates enum values (themeMode, colorTheme, renderMode)
  - Range checks (terminalLimit 1-99)
  - Prevents data corruption from malformed IPC payloads
- Methods: `getSettings()`, `setSettings()`, `resetSettings()`

**`/home/plateau/Desktop/Claude Code/MultiClaude/src/shared/types/index.ts`** (Lines 146-199)
- TypeScript definitions:
  - `ThemeMode = 'light' | 'dark' | 'system'`
  - `ColorTheme = 'default' | 'dusk' | 'lime' | ...` (10 themes)
  - `TerminalRenderMode = 'performance' | 'balanced' | 'quality'`
  - `AppSettings` interface with all settings fields

---

## UI Components

### 4. Settings Modal & Theme Selector

**`/home/plateau/Desktop/Claude Code/MultiClaude/src/renderer/components/settings/settings-modal.tsx`** (140 lines)
- Full-screen modal with sidebar navigation
- **4 tabs:** Appearance, Terminals, Notifications, Updates
- **Save/Cancel flow:**
  - ESC key or Cancel button → `cancelSettings()` + close
  - Save button → `saveSettings()` → persist to disk
  - Save button disabled when `!hasUnsavedChanges`
- Backdrop click to cancel changes

**`/home/plateau/Desktop/Claude Code/MultiClaude/src/renderer/components/settings/theme-selector.tsx`** (159 lines)
- **Appearance Mode Section:**
  - 3 mode cards: System, Light, Dark
  - Icons for each mode (monitor, sun, moon)
- **Color Theme Section:**
  - 10 theme cards in flex-wrap grid
  - Each card shows preview (bg + accent color circles)
  - Theme name + checkmark when selected
- Uses `pendingSettings` for live preview
- All changes immediate but not persisted until Save

**`/home/plateau/Desktop/Claude Code/MultiClaude/src/renderer/components/settings/settings-sidebar.tsx`**
- Left sidebar with tab navigation
- Tab items: Appearance, Terminals, Notifications, Updates

**`/home/plateau/Desktop/Claude Code/MultiClaude/src/renderer/components/settings/settings-panel.tsx`** (100 lines)
- Alternative compact settings panel (not used in modal)
- Horizontal tab buttons instead of sidebar

### 5. Theme Application Logic

**`/home/plateau/Desktop/Claude Code/MultiClaude/src/renderer/App.tsx`** (Lines 216-237)
- **useEffect** watches `pendingSettings.themeMode` and `pendingSettings.colorTheme`
- **Theme class application:**
  1. Determines actual mode (resolve "system" to light/dark via `prefers-color-scheme`)
  2. Removes old classes from `document.documentElement`
  3. Applies new classes: `light|dark` + `theme-{colorTheme}`
  4. Updates window titlebar overlay colors to match theme
- **Titlebar colors:** Uses `--mc-bg-tertiary` equivalent (#2d2d2d dark / #ebebeb light)

---

## How Settings Are Stored

### 6. Persistence Flow

**Storage Location:**
- **Disk:** `electron-store` at `%APPDATA%/multiclaude/multiclaude-settings.json` (Windows)
- **Format:** JSON with AppSettings schema
- **Migration:** Old localStorage data migrated on first load

**Data Flow:**
1. **Startup:** `loadSettings()` → IPC → main/settings-store → renderer store
2. **User edits:** Updates `pendingSettings` in Zustand store (live preview)
3. **Save:** `saveSettings()` → IPC → main validates & writes to disk → updates `savedSettings`
4. **Cancel:** Reverts `pendingSettings` to `savedSettings` (no disk write)

**Default Settings:**
```typescript
{
  themeMode: 'system',
  colorTheme: 'default',
  terminalLimit: { preset: 9 },
  terminalRenderMode: 'balanced',
  glassmorphismEnabled: false,
  windowsShell: { type: 'cmd' }
}
```

---

## Components Using Theme Variables

**43 files** use CSS variables (`--mc-*`):

### Key Components:
- `src/renderer/App.tsx` - Root theme class application
- `src/renderer/components/sidebar/sidebar.tsx` - Sidebar theming
- `src/renderer/components/terminal/terminal-view.tsx` - Terminal UI
- `src/renderer/components/terminal/terminal-grid.tsx` - Terminal grid layout
- `src/renderer/components/terminal/terminal-pane.tsx` - Individual terminal panes
- `src/renderer/components/settings/*` - All settings components
- `src/renderer/components/git-panel/*` - Git panel components
- `src/renderer/components/github-view/*` - GitHub view components
- `src/renderer/components/toast-container.tsx` - Toast notifications

### Common Variable Usage Pattern:
```tsx
<div className="bg-[var(--mc-bg-primary)] text-[var(--mc-text-primary)]">
  <button className="hover:bg-[var(--mc-bg-hover)] border-[var(--mc-border)]">
    Click me
  </button>
</div>
```

---

## Terminal Theming Integration

**Terminal Color Application:**
- Each terminal instance uses `getTerminalTheme(colorTheme, isDark)` from `terminal-themes.ts`
- Applied when terminal created/updated via xterm.js `terminal.options.theme = ...`
- Terminal themes include ANSI colors for syntax highlighting in shells

**Render Modes:**
- `performance`: No WebGL, fastest
- `balanced`: WebGL for active terminal only (default)
- `quality`: WebGL for all terminals

---

## Key Components Requiring Modification

### For New Theme Features:

1. **Theme Definitions:**
   - `src/shared/constants/themes.ts` - Add new ColorTheme
   - `src/shared/constants/terminal-themes.ts` - Add terminal variant
   - `src/shared/types/index.ts` - Update ColorTheme type union

2. **CSS Variables:**
   - `src/renderer/styles/globals.css` - Add `.theme-{new}.light/dark` classes

3. **Settings UI:**
   - `src/renderer/components/settings/theme-selector.tsx` - Already iterates COLOR_THEMES array

4. **Validation:**
   - `src/main/settings/settings-store.ts` - Add to VALID_COLOR_THEMES array

### For Theme Settings Enhancements:

1. **Settings Store:**
   - `src/renderer/stores/settings-store.ts` - Add new setting field + setter
   - `src/main/settings/settings-store.ts` - Add validation logic

2. **Types:**
   - `src/shared/types/index.ts` - Extend AppSettings interface

3. **UI Components:**
   - `src/renderer/components/settings/theme-selector.tsx` - Add new UI controls
   - `src/renderer/components/settings/settings-modal.tsx` - May need new tab

4. **Application:**
   - `src/renderer/App.tsx` - Add useEffect for new setting application

---

## Current Theming Approach Summary

**Architecture:** CSS Variables + Tailwind CSS
- **Pros:**
  - Simple, fast theme switching (just class change)
  - No runtime CSS generation
  - Works well with Tailwind's utility classes
  - Easy to preview changes
- **Cons:**
  - Requires manual CSS class definitions for each theme
  - CSS variables need `var(--mc-*)` syntax (verbose)

**Settings Workflow:** Explicit Save/Cancel
- **Pros:**
  - Live preview without persistence
  - User can experiment safely
  - Clear confirmation step
- **Cons:**
  - Requires modal workflow (not inline)
  - Extra step to persist changes

**Storage:** Electron-store (file-based)
- **Pros:**
  - Persistent across sessions
  - JSON format (human-readable)
  - Validated on write
- **Cons:**
  - IPC overhead for reads/writes
  - File I/O for each change

---

## Unresolved Questions

None - architecture is well-documented and consistent.

---

## Related Test Files

- `src/__tests__/e2e/tests/themes.spec.ts` - Theme switching E2E tests
- `src/__tests__/e2e/tests/settings.spec.ts` - Settings modal E2E tests
- `src/__tests__/e2e/tests/visual-regression.spec.ts` - Visual regression for themes
