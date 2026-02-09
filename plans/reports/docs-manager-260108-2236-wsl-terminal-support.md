# Documentation Update Report: WSL Terminal Support

**Date**: 2026-01-08
**Task ID**: a8cce03
**Feature**: WSL terminal support for Windows

## Files Updated

| File | Changes |
|------|---------|
| `docs/codebase-summary.md` | Version bump to 1.1.6, WSL description, file structure updates |
| `docs/system-architecture.md` | Added `shell-selector-dropdown.tsx`, `shell-utils.ts` to file structure |
| `docs/project-overview-pdr.md` | Version bump, added FR-1.6 for WSL support, feature roadmap update |

## Summary of Changes

### codebase-summary.md
- Updated version: 1.1.4 -> 1.1.6
- Added "(with WSL support on Windows)" to overview
- Added **Shell Selection** entry under Terminal Management section
- Added `shell-selector-dropdown.tsx` to terminal component tree
- Added `utils/` directory with `shell-utils.ts` to renderer file structure
- Added `WindowsShell` type definition to Key Data Structures

### system-architecture.md
- Added `shell-selector-dropdown.tsx` under terminal components
- Added `utils/` directory structure with `shell-utils.ts`

### project-overview-pdr.md
- Updated version to 1.1.6
- Added FR-1.6: WSL shell support (auto-detect distros, default shell setting, right-click selector)
- Added WSL support to Completed (v1.1.x) roadmap section

## Feature Documentation Summary

WSL Terminal Support implementation:
- **WslDetector**: Windows-only utility runs `wsl --list` to detect installed distros
- **Settings UI**: Default shell selector in Terminal Settings (cmd, PowerShell, WSL distros)
- **Context Menu**: Right-click on +New button opens shell selector dropdown
- **Shell Validation**: Saved distro preference reset if distro no longer exists
- **Types**: `WindowsShell`, `WslInfo`, `WslDistro` in shared types
- **Utility**: `getShellKey()` helper for shell option keying
