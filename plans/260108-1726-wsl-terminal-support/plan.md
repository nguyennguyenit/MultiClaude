---
title: "WSL Terminal Support for Windows"
description: "Add WSL distro selection to terminal creation and settings on Windows platform"
status: completed
priority: P2
effort: 6h
issue:
branch: beta
tags: [feature, terminal, windows]
created: 2026-01-08
---

# WSL Terminal Support for Windows

## Overview

Add Windows Subsystem for Linux (WSL) terminal support allowing users to:
1. Select default shell in Settings (Windows only)
2. Choose shell type when creating terminals (right-click dropdown)
3. Auto-detect available WSL distros
4. Gracefully hide all WSL UI if WSL not installed

## Problem Statement

- Current: Windows users only get `cmd.exe`
- Need: Professional devs want WSL for Claude Code (better Linux env)
- Solution: Hybrid approach - Settings default + per-terminal override

## Architecture

### Data Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                         MAIN PROCESS                            │
├─────────────────────────────────────────────────────────────────┤
│  wsl-detector.ts        terminal-manager.ts      handlers.ts   │
│  ┌───────────────┐      ┌──────────────────┐     ┌───────────┐ │
│  │ detectWSL()   │─────>│ create(options)  │<────│ IPC calls │ │
│  │ getDistros()  │      │ - shell option   │     │           │ │
│  │ isAvailable() │      │ - spawn wsl -d X │     │           │ │
│  └───────────────┘      └──────────────────┘     └───────────┘ │
└─────────────────────────────────────────────────────────────────┘
                               ▲
                               │ IPC
                               ▼
┌─────────────────────────────────────────────────────────────────┐
│                       RENDERER PROCESS                          │
├─────────────────────────────────────────────────────────────────┤
│  settings-store.ts          terminal-settings.tsx              │
│  ┌───────────────────┐      ┌────────────────────────────────┐ │
│  │ windowsShell      │<─────│ Default Shell dropdown         │ │
│  │ availableShells   │      │ (only if WSL detected)         │ │
│  └───────────────────┘      └────────────────────────────────┘ │
│                                                                 │
│  terminal-action-bar.tsx                                        │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │ "+ New" button → right-click shows shell selector          │ │
│  └────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

### Shell Types

```typescript
type WindowsShell =
  | { type: 'cmd' }
  | { type: 'powershell' }
  | { type: 'wsl'; distro: string }
```

## Files to Modify/Create

| File | Action | Description |
|------|--------|-------------|
| `src/main/terminal/wsl-detector.ts` | CREATE | WSL detection utility |
| `src/main/terminal/terminal-manager.ts` | MODIFY | Accept shell option, spawn WSL |
| `src/main/ipc/handlers.ts` | MODIFY | Add WSL detection IPC, pass shell to create |
| `src/shared/constants/ipc-channels.ts` | MODIFY | Add WSL_DETECT channel |
| `src/shared/types/index.ts` | MODIFY | Add WindowsShell, update AppSettings |
| `src/renderer/stores/settings-store.ts` | MODIFY | Add windowsShell setting |
| `src/renderer/components/settings/terminal-settings.tsx` | MODIFY | Add shell selector UI |
| `src/renderer/components/terminal/terminal-action-bar.tsx` | MODIFY | Add right-click dropdown |
| `src/preload/index.ts` | MODIFY | Expose WSL detection API |

## Implementation Phases

### Phase 1: WSL Detection (Backend) ✅ DONE (2026-01-08)
- [x] Create `wsl-detector.ts` utility
- [x] Add IPC channel for WSL detection
- [x] Test on Windows with/without WSL

### Phase 2: Terminal Manager Updates ✅ DONE (2026-01-08)
- [x] Update `terminal-manager.ts` to accept shell option
- [x] Implement WSL spawning logic
- [x] Handle WSL spawn failures gracefully

### Phase 3: Types & Settings Store ✅ DONE (2026-01-08)
- [x] Add `WindowsShell` type
- [x] Update `AppSettings` with `windowsShell` field
- [x] Update settings store with persistence

### Phase 4: Settings UI ✅ DONE (2026-01-08)
- [x] Add "Default Shell" section (Windows only)
- [x] Show dropdown only if WSL detected
- [x] Persist selection

### Phase 5: Terminal Creation UI ✅ DONE (2026-01-08)
- [x] Add right-click context menu to "+ New" button
- [x] Show shell selector dropdown
- [x] Use default from Settings for single-click

## Testing Strategy

1. **Windows with WSL**: Full functionality
2. **Windows without WSL**: UI hidden, default cmd.exe
3. **macOS/Linux**: No changes, ignore WSL code
4. **WSL spawn failure**: Graceful fallback to cmd.exe

## Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| WSL not installed | `wsl --list` returns error → hide all WSL UI |
| Saved distro removed | Validate on startup, reset to cmd.exe |
| WSL spawn failure | Try/catch, show error toast, fallback |

## Success Criteria

- [x] Windows users can create WSL terminals
- [x] Settings persist across restarts
- [x] No regressions on macOS/Linux
- [x] Clean UX when WSL not installed
- [x] Graceful error handling

## References

- Brainstorm: `plans/reports/brainstorm-260108-1726-wsl-terminal-support.md`
- Scout: `plans/reports/scout-260108-1751-wsl-terminal-support.md`
