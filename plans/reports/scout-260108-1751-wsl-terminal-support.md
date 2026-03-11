# Scout Report: WSL Terminal Support Implementation

**Task**: Find files for implementing WSL terminal support on Windows  
**Date**: 2026-01-08

---

## Summary

MultiClaude is an Electron app with terminals spawned via `@lydell/node-pty`. Shell selection is currently hardcoded in `getDefaultShell()`. No WSL/PowerShell support exists yet.

---

## 1. Terminal Management (Main Process)

| File | Purpose |
|------|---------|
| `/home/plateau/Desktop/Claude Code/MultiClaude/src/main/terminal/terminal-manager.ts` | **PRIMARY** - PTY spawn logic. `getDefaultShell()` at line 23-28 determines shell. Uses `@lydell/node-pty`. Spawns with `pty.spawn(this.shell, [], {...})` at line 83. |
| `/home/plateau/Desktop/Claude Code/MultiClaude/src/main/terminal/index.ts` | Export barrel for terminal module |
| `/home/plateau/Desktop/Claude Code/MultiClaude/src/main/index.ts` | App entry. Creates `TerminalManager` singleton at line 49 |

**Key Code (terminal-manager.ts:23-28)**:
```typescript
private getDefaultShell(): string {
  if (process.platform === 'win32') {
    return process.env.COMSPEC || 'cmd.exe'
  }
  return process.env.SHELL || '/bin/bash'
}
```

---

## 2. Settings System

### Main Process (Electron Store)
| File | Purpose |
|------|---------|
| `/home/plateau/Desktop/Claude Code/MultiClaude/src/main/project/project-store.ts` | Uses `electron-store` for persistent data. Schema includes projects, session, terminalLayouts |

### Renderer (Zustand + localStorage)
| File | Purpose |
|------|---------|
| `/home/plateau/Desktop/Claude Code/MultiClaude/src/renderer/stores/settings-store.ts` | Zustand store. Uses `localStorage` key `multiclaude-settings`. Has `AppSettings` type. |
| `/home/plateau/Desktop/Claude Code/MultiClaude/src/shared/constants/themes.ts` | `DEFAULT_SETTINGS` definition (line 66-72). Add new shell setting here. |

---

## 3. IPC Handlers

| File | Purpose |
|------|---------|
| `/home/plateau/Desktop/Claude Code/MultiClaude/src/main/ipc/handlers.ts` | All terminal IPC handlers. `TERMINAL_CREATE` at line 66 calls `terminalManager.create(options)` |
| `/home/plateau/Desktop/Claude Code/MultiClaude/src/main/ipc/index.ts` | Export barrel |
| `/home/plateau/Desktop/Claude Code/MultiClaude/src/preload/index.ts` | Bridge API. `terminal.create()` at line 139. Type-safe `ElectronAPI` interface |
| `/home/plateau/Desktop/Claude Code/MultiClaude/src/shared/constants/ipc-channels.ts` | IPC channel constants. Add new shell-related channels if needed |

---

## 4. UI Components

### Terminal Components
| File | Purpose |
|------|---------|
| `/home/plateau/Desktop/Claude Code/MultiClaude/src/renderer/components/terminal/terminal-action-bar.tsx` | Action bar with "+ New" button. Could add shell selector dropdown here |
| `/home/plateau/Desktop/Claude Code/MultiClaude/src/renderer/components/terminal/terminal-grid.tsx` | Grid layout for terminals |
| `/home/plateau/Desktop/Claude Code/MultiClaude/src/renderer/components/terminal/terminal-pane.tsx` | Individual terminal pane wrapper |
| `/home/plateau/Desktop/Claude Code/MultiClaude/src/renderer/components/terminal/terminal-view.tsx` | xterm.js integration |

### Settings Components
| File | Purpose |
|------|---------|
| `/home/plateau/Desktop/Claude Code/MultiClaude/src/renderer/components/settings/terminal-settings.tsx` | **ADD WSL SETTINGS HERE** - Terminal config UI. Currently has limit/render mode settings |
| `/home/plateau/Desktop/Claude Code/MultiClaude/src/renderer/components/settings/settings-panel.tsx` | Settings tabs layout |
| `/home/plateau/Desktop/Claude Code/MultiClaude/src/renderer/components/settings/settings-sidebar.tsx` | Settings sidebar with tab definitions |
| `/home/plateau/Desktop/Claude Code/MultiClaude/src/renderer/components/settings/settings-typography.tsx` | Shared typography components |

---

## 5. Shared Types

| File | Purpose |
|------|---------|
| `/home/plateau/Desktop/Claude Code/MultiClaude/src/shared/types/index.ts` | **PRIMARY** - All types. `Terminal` interface (line 2-12), `AppSettings` (line 174-180), `TerminalRenderMode` (line 151) |

**Current AppSettings (line 174-180)**:
```typescript
export interface AppSettings {
  themeMode: ThemeMode
  colorTheme: ColorTheme
  terminalLimit: TerminalLimit
  terminalRenderMode: TerminalRenderMode
  glassmorphismEnabled: boolean
}
```

---

## Implementation Plan

### Types to Add (`src/shared/types/index.ts`)
```typescript
export type ShellType = 'default' | 'powershell' | 'pwsh' | 'wsl' | 'wsl-distro' | 'custom'
export interface ShellConfig {
  type: ShellType
  customPath?: string
  wslDistro?: string
}
```

### Extend AppSettings
Add `defaultShell: ShellConfig` to `AppSettings` interface.

### Modify TerminalManager
- Accept shell config in `create()` options
- Add `getShellCommand(config: ShellConfig)` method
- WSL spawn: `wsl.exe -d <distro>` or `wsl.exe` for default

### Modify terminal-settings.tsx
- Add "Default Shell" dropdown (cmd, PowerShell, PowerShell Core, WSL)
- Add distro selector when WSL selected
- Windows-only visibility

---

## Files to Modify (Priority Order)

1. `/home/plateau/Desktop/Claude Code/MultiClaude/src/shared/types/index.ts` - Add types
2. `/home/plateau/Desktop/Claude Code/MultiClaude/src/shared/constants/themes.ts` - Update `DEFAULT_SETTINGS`
3. `/home/plateau/Desktop/Claude Code/MultiClaude/src/main/terminal/terminal-manager.ts` - Shell selection logic
4. `/home/plateau/Desktop/Claude Code/MultiClaude/src/renderer/stores/settings-store.ts` - Add shell setting actions
5. `/home/plateau/Desktop/Claude Code/MultiClaude/src/renderer/components/settings/terminal-settings.tsx` - Shell picker UI
6. `/home/plateau/Desktop/Claude Code/MultiClaude/src/preload/index.ts` - Add WSL distro list IPC if needed
7. `/home/plateau/Desktop/Claude Code/MultiClaude/src/main/ipc/handlers.ts` - WSL distro enumeration handler

---

## Unresolved Questions

1. Should shell preference be global or per-project?
2. Should users be able to select different shells per terminal instance?
3. Need IPC for enumerating installed WSL distros? (`wsl -l -q`)
