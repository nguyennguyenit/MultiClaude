# Brainstorm: WSL Terminal Support for Windows

## Problem Statement

Windows users (especially professional devs) need WSL terminal support since:
- Claude Code works better in Linux environments
- Professional devs use WSL for their daily workflow
- Current implementation only supports `cmd.exe`

## Context

- **Origin**: User request (real demand)
- **Target Audience**: Professional developers on Windows
- **Current State**: Only `cmd.exe` via `process.env.COMSPEC`

## Evaluated Approaches

### Option 1: WSL Dropdown on Terminal Creation
**Pros**: Flexible, lets user choose per-terminal
**Cons**: Extra click every time, friction for common case

### Option 2: Settings Default Only
**Pros**: Set once, forget
**Cons**: No flexibility for mixed workflows (WSL + PowerShell)

### Option 3: Hybrid (Recommended) ✅
**Pros**: Best of both - default in Settings + override on creation
**Cons**: Slightly more implementation work

## Final Recommendation

**Hybrid approach** with:

1. **Settings Page** (Windows only):
   - Default shell selector: `cmd.exe | PowerShell | WSL distros...`
   - Auto-detect installed WSL distros via `wsl --list --quiet`

2. **Terminal Creation** (Windows only):
   - Single-click "+": Use Settings default
   - Right-click/long-press "+": Show shell dropdown

3. **macOS/Linux**: No changes, use native `$SHELL`

## Implementation Considerations

### Technical Details
- Detect WSL: `wsl --list --quiet`
- Spawn WSL shell: `wsl -d <distro>` or `wsl.exe -d <distro>`
- Store preference: electron-store
- Platform guard: Only show WSL options on Windows

### UI Changes
- Settings → Terminals section: Add "Default Shell" dropdown (Windows only)
- Terminal "+" button: Add context menu for shell selection (Windows only)

### Conditional UI (Simplified)

If WSL not detected on Windows:
- Hide "Default Shell" section in Settings completely
- Hide shell dropdown on terminal creation
- Behave like macOS/Linux (auto-spawn default shell)

This avoids confusing users who don't have WSL installed.

### Risks & Mitigations
| Risk | Mitigation |
|------|------------|
| WSL not installed | Hide all WSL-related UI completely |
| Saved distro removed | Validate on startup, reset to default if invalid |
| WSL spawn failure | Graceful error message, fallback to cmd.exe |

## Success Metrics

- Windows users can create WSL terminals
- No regressions on macOS/Linux
- Settings persist across app restarts

## Next Steps

1. Implement WSL detection utility
2. Add Settings UI for default shell (Windows only)
3. Update terminal creation flow with shell selector
4. Test on Windows with various WSL configs

## Unresolved Questions

None - approach is clear and agreed upon.
