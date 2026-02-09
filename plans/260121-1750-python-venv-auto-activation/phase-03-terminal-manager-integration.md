# Phase 03: Terminal Manager Integration

## Context
- Parent: [plan.md](./plan.md)
- Dependencies: Phase 01 (Types), Phase 02 (Detector)

## Overview
- **Priority**: P1
- **Status**: ⏳ Pending
- **Effort**: 45m

Integrate venv detection and activation into terminal creation flow.

## Key Insights
- Terminal creation happens in `TerminalManager.create()`
- Need to determine shell type from `WindowsShell` option
- Inject activation after PTY spawn with small delay for readiness
- Settings passed via IPC handlers

## Requirements

### Functional
- FR-01: Check global autoActivatePythonVenv setting
- FR-02: Detect venv in project path
- FR-03: Inject shell-appropriate activation command
- FR-04: Support all shell types (bash, cmd, powershell, wsl)

### Non-Functional
- NFR-01: Non-blocking - don't delay terminal display
- NFR-02: Silent failure - no error if activation fails

## Architecture

```
TerminalManager.create()
  ├── Spawn PTY (existing)
  ├── Check autoActivatePythonVenv setting
  ├── detectPythonVenv(cwd)
  ├── If venv found:
  │   ├── Determine shell type
  │   ├── Get activation command
  │   └── setTimeout(100ms) → pty.write(command)
  └── Return terminal (existing)
```

## Related Code Files

### Modify
- `src/main/terminal/terminal-manager.ts` - Add venv activation logic
- `src/main/ipc/handlers.ts` - Pass settings to terminal creation

### Reference
- `src/main/terminal/venv-detector.ts` - Detection functions
- `src/main/settings/settings-store.ts` - Get settings

## Implementation Steps

1. **Update create() signature** (`terminal-manager.ts:126`)
   ```typescript
   create(options: {
     cwd?: string
     projectId?: string
     shell?: WindowsShell
     autoActivateVenv?: boolean  // NEW: Override or use global
   } = {}): Terminal
   ```

2. **Add venv activation logic** (`terminal-manager.ts` after line 177)
   ```typescript
   // After: this.terminals.set(id, termProcess)

   // Venv auto-activation
   if (options.autoActivateVenv !== false) {
     const venvPath = detectPythonVenv(cwd)
     if (venvPath) {
       const shellType = this.getShellType(options.shell)
       const activationCmd = getActivationCommand(venvPath, shellType)
       // Delay for PTY readiness
       setTimeout(() => {
         ptyProcess.write(activationCmd)
       }, 100)
     }
   }
   ```

3. **Add shell type helper** (`terminal-manager.ts`)
   ```typescript
   /**
    * Map WindowsShell to shell type for venv activation.
    */
   private getShellType(shell?: WindowsShell): 'bash' | 'cmd' | 'powershell' | 'wsl' {
     if (process.platform !== 'win32') {
       return 'bash'
     }
     if (!shell) return 'cmd'
     if (shell.type === 'powershell') return 'powershell'
     if (shell.type === 'wsl') return 'wsl'
     return 'cmd'
   }
   ```

4. **Update imports** (`terminal-manager.ts`)
   ```typescript
   import { detectPythonVenv, getActivationCommand } from './venv-detector'
   ```

5. **Update IPC handler** (`handlers.ts` - TERMINAL_CREATE handler)
   ```typescript
   ipcMain.handle(IPC_CHANNELS.TERMINAL_CREATE, async (_, options) => {
     const settings = settingsStore.getSettings()
     return terminalManager.create({
       ...options,
       autoActivateVenv: settings.autoActivatePythonVenv
     })
   })
   ```

## Todo List
- [ ] Import venv-detector in terminal-manager.ts
- [ ] Add getShellType helper method
- [ ] Add venv activation in create() method
- [ ] Update IPC handler to pass settings
- [ ] Test with different shell types

## Success Criteria
- [ ] Terminal activates venv when present
- [ ] Correct activation command per shell
- [ ] No activation when setting is false
- [ ] No error when venv not present

## Risk Assessment
| Risk | Impact | Mitigation |
|------|--------|------------|
| Timing issue (PTY not ready) | Medium | 100ms delay, increase if needed |
| Activation fails silently | Low | Expected behavior, no crash |
| Performance impact | Low | Async setTimeout, non-blocking |

## Security Considerations
- Venv path comes from filesystem, not user input
- Paths quoted to prevent injection

## Next Steps
→ Phase 04: Settings Store Updates
