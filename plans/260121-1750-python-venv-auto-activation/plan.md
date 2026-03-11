---
title: "Python Venv Auto-Activation"
description: "Auto-activate Python virtual environments when spawning terminals"
status: pending
priority: P2
effort: 2h
branch: beta
tags: [terminal, python, venv, developer-experience]
created: 2026-01-21
---

# Python Venv Auto-Activation

## Overview

Add automatic Python virtual environment activation when spawning terminals in MultiClaude, similar to VSCode's integrated terminal behavior.

## Approach

- **Approach 1 (Script Injection)**: Inject activation command after PTY spawn
- **Approach 3 (Project Config)**: Per-project venv path configuration

## Implementation Phases

| Phase | Name | Status | Effort |
|-------|------|--------|--------|
| 01 | Types & Constants | ⏳ Pending | 15m |
| 02 | Venv Detector Module | ⏳ Pending | 30m |
| 03 | Terminal Manager Integration | ⏳ Pending | 45m |
| 04 | Settings Store Updates | ⏳ Pending | 30m |

## Phase Details

### Phase 01: Types & Constants
- Add `autoActivatePythonVenv: boolean` to AppSettings
- Add `pythonVenv?: { path: string; autoActivate: boolean }` to Project
- Update DEFAULT_SETTINGS
- [→ phase-01-types-and-constants.md](./phase-01-types-and-constants.md)

### Phase 02: Venv Detector Module
- Create `src/main/terminal/venv-detector.ts`
- Detect .venv, venv, env folders
- Check activation script existence per platform
- [→ phase-02-venv-detector-module.md](./phase-02-venv-detector-module.md)

### Phase 03: Terminal Manager Integration
- Import and use venv detector
- Inject activation command after PTY spawn
- Handle shell types (bash/zsh/cmd/powershell/wsl)
- [→ phase-03-terminal-manager-integration.md](./phase-03-terminal-manager-integration.md)

### Phase 04: Settings Store Updates
- Add validation for new setting
- Update renderer store
- [→ phase-04-settings-store-updates.md](./phase-04-settings-store-updates.md)

## Success Criteria

- [ ] Venv auto-detected when terminal spawns in project with venv folder
- [ ] Activation command injected correctly per shell type
- [ ] Global setting controls feature on/off
- [ ] No activation if venv not present
- [ ] Cross-platform support (Linux/macOS/Windows)

## Dependencies

- `src/main/terminal/terminal-manager.ts`
- `src/shared/types/index.ts`
- `src/shared/constants/themes.ts`
- `src/main/settings/settings-store.ts`
- `src/renderer/stores/settings-store.ts`

## References

- [Codebase Summary](../../docs/codebase-summary.md)
- [System Architecture](../../docs/system-architecture.md)
- [Code Standards](../../docs/code-standards.md)
