# Scout Report: Settings & Terminal Management Files

## Settings Components & Stores

| File | Purpose |
|------|---------|
| `/home/plateau/Desktop/Claude Code/MultiClaude/src/renderer/stores/settings-store.ts` | Zustand store for app settings (theme mode, color theme). Persists to localStorage. |
| `/home/plateau/Desktop/Claude Code/MultiClaude/src/renderer/components/settings/settings-panel.tsx` | Settings UI panel with tabs (Appearance, Notifications). |
| `/home/plateau/Desktop/Claude Code/MultiClaude/src/renderer/components/settings/notification-settings.tsx` | Notification settings component. |
| `/home/plateau/Desktop/Claude Code/MultiClaude/src/shared/constants/themes.ts` | `DEFAULT_SETTINGS` definition & `COLOR_THEMES` array. |
| `/home/plateau/Desktop/Claude Code/MultiClaude/src/shared/types/index.ts` | `AppSettings` type: `{ themeMode, colorTheme }`. |

## Terminal Management

| File | Purpose |
|------|---------|
| `/home/plateau/Desktop/Claude Code/MultiClaude/src/main/terminal/terminal-manager.ts` | Main process terminal manager - creates/destroys PTY processes. **No terminal limit exists.** |
| `/home/plateau/Desktop/Claude Code/MultiClaude/src/renderer/stores/app-store.ts` | Zustand store managing terminals array, `addTerminal()`, `removeTerminal()`. **No limit check.** |
| `/home/plateau/Desktop/Claude Code/MultiClaude/src/renderer/components/terminal/terminal-grid.tsx` | Renders terminal grid layout (max 12 visual slots via `calculateGrid()`). |
| `/home/plateau/Desktop/Claude Code/MultiClaude/src/renderer/components/terminal/terminal-pane.tsx` | Individual terminal pane wrapper with header/controls. |
| `/home/plateau/Desktop/Claude Code/MultiClaude/src/renderer/components/terminal/terminal-view.tsx` | XTerm.js terminal view component. |
| `/home/plateau/Desktop/Claude Code/MultiClaude/src/renderer/hooks/use-terminal.ts` | Terminal initialization hook (XTerm setup, WebGL, theming). |
| `/home/plateau/Desktop/Claude Code/MultiClaude/src/main/ipc/handlers.ts` | IPC handlers including `TERMINAL_CREATE` - calls `terminalManager.create()`. |

## Terminal Creation Entry Points

| Location | Function |
|----------|----------|
| `/home/plateau/Desktop/Claude Code/MultiClaude/src/renderer/App.tsx` | `handleAddTerminal()` - calls `window.electron.terminal.create()` then `addTerminal()`. |
| `/home/plateau/Desktop/Claude Code/MultiClaude/src/renderer/components/sidebar/sidebar.tsx` | `handleAddTerminal()` - same pattern, triggered by "New Terminal" button. |

## Current Limit/Validation Status

**No terminal limit currently exists.**

- `terminal-grid.tsx` line 27: `return { rows: 3, cols: 4 } // max 12` - visual grid caps at 12, but **no enforcement**.
- `app-store.ts`: `addTerminal()` has no count check.
- `terminal-manager.ts`: `create()` has no limit enforcement.
- `settings-store.ts`: Only stores `themeMode` + `colorTheme` - no terminal settings.

## Files to Modify for Terminal Limit Feature

1. **Types**: `/home/plateau/Desktop/Claude Code/MultiClaude/src/shared/types/index.ts` - extend `AppSettings`
2. **Constants**: `/home/plateau/Desktop/Claude Code/MultiClaude/src/shared/constants/themes.ts` - add to `DEFAULT_SETTINGS`
3. **Settings Store**: `/home/plateau/Desktop/Claude Code/MultiClaude/src/renderer/stores/settings-store.ts` - add setter
4. **Settings UI**: `/home/plateau/Desktop/Claude Code/MultiClaude/src/renderer/components/settings/settings-panel.tsx` - add new tab
5. **Validation Points**:
   - `/home/plateau/Desktop/Claude Code/MultiClaude/src/renderer/App.tsx` - check before `handleAddTerminal()`
   - `/home/plateau/Desktop/Claude Code/MultiClaude/src/renderer/components/sidebar/sidebar.tsx` - check before `handleAddTerminal()`
