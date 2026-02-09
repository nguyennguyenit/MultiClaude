# Phase 3: Terminal Manager Extension

## Context

- Parent: [plan.md](./plan.md)
- Dependencies: [Phase 2](./phase-02-ssh-core-infrastructure.md)
- Docs: [codebase-summary.md](../../docs/codebase-summary.md)

## Overview

| Field | Value |
|-------|-------|
| Date | 2026-01-08 |
| Priority | P1 |
| Effort | 3h |
| Status | pending |
| Review | pending |

Extend TerminalManager to support SSH connections alongside local PTY.

## Key Insights

- Keep unified interface for both local and SSH terminals
- Store SSH connections in separate Map (SSHConnection instances)
- Emit same events (output, exit, titleChange) for consistency
- Add connection type discriminator to Terminal metadata

## Requirements

1. Add SSH connection storage to TerminalManager
2. Implement createSSH(), destroySSH() methods
3. Route write(), resize() based on connection type
4. Handle reconnection logic
5. Emit unified events for renderer

## Architecture

### Extended TerminalManager

```typescript
interface SSHProcess {
  id: string
  connection: SSHConnection
  metadata: Terminal
  outputBuffer: string
}

export class TerminalManager extends EventEmitter {
  private terminals: Map<string, PTYProcess> = new Map()
  private sshTerminals: Map<string, SSHProcess> = new Map()

  // New SSH methods
  async createSSH(config: SSHConnectionConfig): Promise<Terminal>
  destroySSH(id: string): boolean
  reconnectSSH(id: string): Promise<boolean>

  // Extended existing methods
  write(id: string, data: string): boolean {
    // Check both maps
    const pty = this.terminals.get(id)
    if (pty) { pty.pty.write(data); return true }

    const ssh = this.sshTerminals.get(id)
    if (ssh) { ssh.connection.write(data); return true }

    return false
  }
}
```

### Event Unification

Both PTY and SSH terminals emit:
- `output` - Terminal data
- `exit` - Terminal closed
- `titleChange` - Title updated
- `statusChange` - SSH status changed (new)

## Related Code Files

| File | Action |
|------|--------|
| `src/main/terminal/terminal-manager.ts` | Modify |
| `src/main/terminal/index.ts` | Modify |

## Implementation Steps

1. Import SSHConnection from ssh module
2. Add sshTerminals Map to TerminalManager
3. Implement createSSH() method
4. Implement destroySSH() method
5. Implement reconnectSSH() method
6. Update write() to check both maps
7. Update resize() to check both maps
8. Update list() to include SSH terminals
9. Update destroy() to handle both types
10. Add destroyAllSSH() method
11. Update destroyAll() to destroy both types

## Todo List

- [ ] Add sshTerminals Map to TerminalManager
- [ ] Implement createSSH() with SSHConnection
- [ ] Implement destroySSH() method
- [ ] Implement reconnectSSH() with backoff
- [ ] Update write() for unified routing
- [ ] Update resize() for unified routing
- [ ] Update list() to include SSH terminals
- [ ] Update destroyAll() to include SSH
- [ ] Emit statusChange event for SSH state
- [ ] Add unit tests for SSH methods

## Success Criteria

- [ ] createSSH() returns Terminal with connectionType: 'ssh'
- [ ] write() routes to correct backend (PTY or SSH)
- [ ] resize() works for both terminal types
- [ ] list() returns unified terminal list
- [ ] destroyAll() cleans up both types
- [ ] Events emitted consistently

## Risk Assessment

| Risk | Impact | Mitigation |
|------|--------|------------|
| Mixed concerns in single class | Medium | Consider extraction later if too complex |
| Race conditions on reconnect | Medium | Use status flag to prevent duplicate connects |

## Security Considerations

- Validate terminal ID before routing
- Log SSH events without sensitive data

## Next Steps

After completion, proceed to [Phase 4: IPC Handlers & Preload](./phase-04-ipc-handlers-preload.md)
