# Phase 2: Terminal Manager Updates

**Effort**: 1h

## Objective

Update TerminalManager to accept shell option and spawn WSL terminals.

## Tasks

### 2.1 Update Terminal Create Options

**File**: `src/main/terminal/terminal-manager.ts` (MODIFY)

Update create method signature and implementation:

```typescript
// Add import at top
import type { WindowsShell } from '@shared/types'

// Update create options interface (add inside file or import)
interface CreateOptions {
  cwd?: string
  projectId?: string
  shell?: WindowsShell  // New field
}

// Update create method
create(options: CreateOptions = {}): Terminal {
  const id = this.generateId()
  const cwd = options.cwd || os.homedir()

  // Determine shell command and args
  const { command, args } = this.getShellCommand(options.shell)

  const ptyProcess = pty.spawn(command, args, {
    name: 'xterm-256color',
    cwd,
    env: { ...process.env, TERM: 'xterm-256color' },
    cols: 80,
    rows: 24
  })

  // ... rest unchanged
}

// Add new method
private getShellCommand(shell?: WindowsShell): { command: string; args: string[] } {
  // Non-Windows: use default shell
  if (process.platform !== 'win32') {
    return {
      command: process.env.SHELL || '/bin/bash',
      args: []
    }
  }

  // Windows: check shell option
  if (!shell || shell.type === 'cmd') {
    return {
      command: process.env.COMSPEC || 'cmd.exe',
      args: []
    }
  }

  if (shell.type === 'powershell') {
    return {
      command: 'powershell.exe',
      args: ['-NoLogo']
    }
  }

  if (shell.type === 'wsl') {
    return {
      command: 'wsl.exe',
      args: ['-d', shell.distro]
    }
  }

  // Fallback
  return {
    command: process.env.COMSPEC || 'cmd.exe',
    args: []
  }
}
```

### 2.2 Update IPC Handler

**File**: `src/main/ipc/handlers.ts` (MODIFY)

The existing handler already passes options through:
```typescript
ipcMain.handle(IPC_CHANNELS.TERMINAL_CREATE, async (_, options) => {
  return terminalManager.create(options)
})
```

No change needed - `shell` option will be passed through.

### 2.3 Export Index Update

**File**: `src/main/terminal/index.ts` (MODIFY)

Add export if not already:
```typescript
export * from './wsl-detector'
```

## Acceptance Criteria

- [ ] `create({ shell: { type: 'cmd' } })` spawns cmd.exe
- [ ] `create({ shell: { type: 'powershell' } })` spawns PowerShell
- [ ] `create({ shell: { type: 'wsl', distro: 'Ubuntu' } })` spawns WSL Ubuntu
- [ ] `create()` defaults to cmd.exe on Windows
- [ ] No behavior change on macOS/Linux

## Error Handling

If WSL distro spawn fails:
- PTY `onExit` fires with non-zero exit code
- Renderer receives exit event
- User sees terminal close immediately
- Future: Show error toast (handled in Phase 5)
