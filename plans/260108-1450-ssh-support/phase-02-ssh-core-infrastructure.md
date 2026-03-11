# Phase 2: SSH Core Infrastructure

## Context

- Parent: [plan.md](./plan.md)
- Dependencies: [Phase 1](./phase-01-types-ipc-channels.md)
- Docs: [system-architecture.md](../../docs/system-architecture.md)

## Overview

| Field | Value |
|-------|-------|
| Date | 2026-01-08 |
| Priority | P1 |
| Effort | 4h |
| Status | pending |
| Review | pending |

Implement core SSH infrastructure: ssh2 wrapper, config parser, profile store.

## Key Insights

- Use ssh2 for SSH connections (pure JS, Electron compatible)
- Use ssh-config for parsing ~/.ssh/config
- Use chokidar for file watching (already in project)
- Use electron-store for custom profile persistence

## Requirements

1. SSHConnection class wrapping ssh2 Client
2. SSHConfigWatcher for parsing/watching ~/.ssh/config
3. SSHProfileStore for custom profiles (electron-store)
4. SSHAuthHandler for authentication flow

## Architecture

### File Structure

```
src/main/ssh/
├── index.ts                 # Barrel export
├── ssh-connection.ts        # ssh2 wrapper class
├── ssh-config-watcher.ts    # ~/.ssh/config parser + watcher
├── ssh-profile-store.ts     # electron-store for custom profiles
└── ssh-auth-handler.ts      # Auth flow (agent → key → password)
```

### SSHConnection Class

```typescript
import { Client, ClientChannel } from 'ssh2'
import { EventEmitter } from 'events'
import { SSHConnectionConfig, SSHStatus } from '@shared/types'

export class SSHConnection extends EventEmitter {
  private client: Client
  private stream: ClientChannel | null = null
  private config: SSHConnectionConfig
  private status: SSHStatus = 'disconnected'

  constructor(config: SSHConnectionConfig) {
    super()
    this.config = config
    this.client = new Client()
    this.setupEventHandlers()
  }

  async connect(): Promise<void> {
    this.setStatus('connecting')
    // Connect using config (agent, key, or password)
  }

  write(data: string): void {
    this.stream?.write(data)
  }

  resize(cols: number, rows: number): void {
    this.stream?.setWindow(rows, cols, 0, 0)
  }

  disconnect(): void {
    this.client.end()
  }
}
```

### SSHConfigWatcher

```typescript
import SSHConfig from 'ssh-config'
import chokidar from 'chokidar'
import { SSHProfile } from '@shared/types'

export class SSHConfigWatcher extends EventEmitter {
  private watcher: FSWatcher | null = null
  private profiles: SSHProfile[] = []

  start(): void {
    const configPath = path.join(os.homedir(), '.ssh', 'config')
    this.watcher = chokidar.watch(configPath)
    this.watcher.on('change', () => this.parse())
    this.parse() // Initial parse
  }

  getProfiles(): SSHProfile[] {
    return this.profiles
  }

  stop(): void {
    this.watcher?.close()
  }
}
```

## Related Code Files

| File | Action |
|------|--------|
| `src/main/ssh/index.ts` | Create |
| `src/main/ssh/ssh-connection.ts` | Create |
| `src/main/ssh/ssh-config-watcher.ts` | Create |
| `src/main/ssh/ssh-profile-store.ts` | Create |
| `src/main/ssh/ssh-auth-handler.ts` | Create |
| `package.json` | Modify (add deps) |

## Implementation Steps

1. Install dependencies: `npm install ssh2 ssh-config`
2. Install types: `npm install -D @types/ssh2`
3. Create ssh-connection.ts with ssh2 wrapper
4. Create ssh-config-watcher.ts with chokidar integration
5. Create ssh-profile-store.ts with electron-store
6. Create ssh-auth-handler.ts for auth flow
7. Create index.ts barrel export

## Todo List

- [ ] Install ssh2, ssh-config, @types/ssh2
- [ ] Create SSHConnection class with connect/write/resize/disconnect
- [ ] Create SSHConfigWatcher with file watching
- [ ] Create SSHProfileStore for custom profiles
- [ ] Create SSHAuthHandler for agent → key → password flow
- [ ] Create index.ts exporting all classes
- [ ] Add unit tests for SSHConfigWatcher

## Success Criteria

- [ ] SSHConnection can establish shell session
- [ ] SSHConfigWatcher parses ~/.ssh/config correctly
- [ ] SSHProfileStore persists custom profiles
- [ ] Auth flow handles agent, key, password methods
- [ ] Events emitted: output, close, error, status

## Risk Assessment

| Risk | Impact | Mitigation |
|------|--------|------------|
| ssh2 doesn't work in Electron | High | Test early, fallback to native module |
| Config parsing edge cases | Medium | Graceful fallback, log warnings |
| Key passphrase prompt blocking | Medium | Use IPC to prompt user in renderer |

## Security Considerations

- Never log passwords or private keys
- Use Electron safeStorage for remembered credentials
- Clear password from memory after use
- Validate host key (future enhancement)

## Next Steps

After completion, proceed to [Phase 3: Terminal Manager Extension](./phase-03-terminal-manager-extension.md)
