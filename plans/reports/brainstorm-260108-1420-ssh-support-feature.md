# Brainstorm: SSH Support Feature

**Date**: 2026-01-08
**Status**: Finalized
**Scope**: Remote Claude Code + Server Management via SSH

---

## Problem Statement

MultiClaude currently only supports local terminal sessions via `node-pty`. Users need ability to:
1. Run Claude Code on remote servers through SSH
2. Manage remote servers (DevOps, logs, deployment) from MultiClaude
3. Integrate with existing `~/.ssh/config` profiles

---

## Requirements Summary

| Requirement | Decision |
|-------------|----------|
| Use Case | Both: Remote Claude Code + Server Management |
| Auth Methods | Full: Keys, Password, SSH Agent, Custom Identity |
| Profile Management | Hybrid: Import ~/.ssh/config + Central store + Project association |
| UI Experience | Integrated: SSH terminals look like local with badge |

---

## Evaluated Approaches

### Architecture Options

| Option | Pros | Cons | Verdict |
|--------|------|------|---------|
| **A: Separate SSHTerminalManager** | Clean separation, easier testing | Code duplication, two managers to maintain | ❌ |
| **B: Abstract Base Class** | DRY, extensible | High refactor effort, over-engineering | ❌ |
| **C: Extend Existing** | Minimal refactor, single source of truth | Class size grows, mixed concerns | ✅ Selected |

### Config Parsing Options

| Option | Pros | Cons | Verdict |
|--------|------|------|---------|
| Real-time parsing | Always fresh | Performance hit on each access | ❌ |
| Parse on startup | Simple | Stale data if user edits config | ❌ |
| **File watcher** | Auto-refresh, responsive | Slight complexity | ✅ Selected |

### Credential Storage Options

| Option | Pros | Cons | Verdict |
|--------|------|------|---------|
| Encrypt local only | Persistent | Security risk if key exposed | ❌ |
| Memory only | Most secure | Bad UX (re-enter each session) | ❌ |
| SSH Agent only | Standard approach | Not all users use agent | ❌ |
| **Hybrid** | Best of both worlds | Complexity | ✅ Selected |

---

## Agreed Solution

### 1. Architecture: Extended TerminalManager

```
src/main/terminal/
├── terminal-manager.ts      # Extended with SSH support
├── ssh-connection.ts        # SSH connection wrapper using ssh2
├── ssh-config-parser.ts     # ~/.ssh/config parser with watcher
└── ssh-profile-store.ts     # electron-store for custom profiles
```

**Terminal Type Extension:**
```typescript
interface Terminal {
  id: string
  title: string
  cwd: string
  isClaudeMode: boolean
  // New SSH fields
  connectionType: 'local' | 'ssh'
  sshConfig?: SSHConnectionConfig
  sshStatus?: 'connecting' | 'connected' | 'disconnected' | 'error'
}

interface SSHConnectionConfig {
  host: string
  port: number
  username: string
  authMethod: 'key' | 'password' | 'agent'
  privateKeyPath?: string
  profileName?: string  // Reference to ~/.ssh/config host
}
```

### 2. SSH Library: ssh2

- Industry standard for Node.js
- Pure JavaScript, no native compilation
- Full feature set: shell, exec, agent forwarding
- Active maintenance, Electron compatible

**Integration Pattern:**
```typescript
// In terminal-manager.ts
createSSH(config: SSHConnectionConfig): Promise<Terminal> {
  const conn = new Client()
  conn.on('ready', () => {
    conn.shell((err, stream) => {
      // Pipe stream to renderer like PTY output
      stream.on('data', (data) => {
        this.emit('output', { terminalId: id, data: data.toString() })
      })
    })
  })
  conn.connect({...})
}
```

### 3. Config Management

**~/.ssh/config Watcher:**
```typescript
// ssh-config-parser.ts
import SSHConfig from 'ssh-config'
import chokidar from 'chokidar'

class SSHConfigWatcher {
  private watcher: FSWatcher
  private profiles: Map<string, SSHProfile>

  start() {
    const configPath = path.join(os.homedir(), '.ssh', 'config')
    this.watcher = chokidar.watch(configPath)
    this.watcher.on('change', () => this.parse())
  }
}
```

**Profile Store (electron-store):**
```typescript
// Custom profiles stored separately from ~/.ssh/config
interface SSHProfileStore {
  profiles: SSHProfile[]
  projectAssociations: Map<projectId, profileId>
}
```

### 4. Authentication Flow

```
┌─────────────────┐
│ User initiates  │
│ SSH connection  │
└────────┬────────┘
         │
         ▼
┌─────────────────┐    Yes    ┌─────────────────┐
│  SSH Agent      │──────────▶│  Use Agent      │
│  available?     │           │  auth           │
└────────┬────────┘           └─────────────────┘
         │ No
         ▼
┌─────────────────┐    Yes    ┌─────────────────┐
│  Key file       │──────────▶│  Prompt for     │
│  exists?        │           │  passphrase     │
└────────┬────────┘           │  (if encrypted) │
         │ No                 └────────┬────────┘
         ▼                             │
┌─────────────────┐                    │
│  Prompt for     │                    │
│  password       │◀───────────────────┘
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Store in       │
│  safeStorage    │
│  (optional)     │
└─────────────────┘
```

### 5. UI Components

**Quick Connect Bar (Terminal Tab Bar):**
```
┌─────────────────────────────────────────────────────────────┐
│ [Terminal 1] [Terminal 2] [🔌 dev-server] [+] │ [🔗 SSH ▾] │
└─────────────────────────────────────────────────────────────┘
                                                      │
                                        ┌─────────────▼──────────────┐
                                        │ 📋 Recent:                 │
                                        │   🖥️ dev-server (saved)    │
                                        │   🖥️ prod-db (saved)       │
                                        │ ─────────────────────────  │
                                        │ 📂 From ~/.ssh/config:     │
                                        │   🖥️ github.com            │
                                        │   🖥️ myserver              │
                                        │ ─────────────────────────  │
                                        │ [+ New Connection...]      │
                                        └────────────────────────────┘
```

**SSH Terminal Badge:**
```
┌──────────────────────────────────────────┐
│ 🔌 dev-server [●]  [Claude] [✕]          │  ← SSH badge + status indicator
├──────────────────────────────────────────┤
│ plateau@dev-server:~$                    │
│                                          │
└──────────────────────────────────────────┘
```

Status indicators:
- 🟢 Connected
- 🟡 Connecting / Reconnecting
- 🔴 Disconnected / Error

### 6. Reconnection Strategy

**Exponential Backoff:**
```
Attempt 1: wait 1s
Attempt 2: wait 2s
Attempt 3: wait 4s
After 3 failures: Show "Reconnect" button
```

**User notification:**
- Toast: "SSH connection lost. Reconnecting..."
- Toast: "Reconnected to dev-server"
- Toast: "Failed to reconnect after 3 attempts"

---

## Implementation Considerations

### Files to Modify

| File | Changes |
|------|---------|
| `src/shared/types/index.ts` | Add SSH types, extend Terminal |
| `src/shared/constants.ts` | Add SSH IPC channels |
| `src/main/terminal/terminal-manager.ts` | Add SSH connection methods |
| `src/main/ipc/handlers.ts` | Register SSH handlers |
| `src/preload/index.ts` | Expose SSH API |
| `src/renderer/components/terminal/` | SSH badge, Quick Connect UI |
| `src/renderer/stores/app-store.ts` | SSH profile state |

### New Files

| File | Purpose |
|------|---------|
| `src/main/ssh/ssh-connection.ts` | ssh2 wrapper class |
| `src/main/ssh/ssh-config-watcher.ts` | Parse & watch ~/.ssh/config |
| `src/main/ssh/ssh-profile-store.ts` | electron-store for profiles |
| `src/main/ssh/ssh-auth-handler.ts` | Auth flow logic |
| `src/renderer/components/ssh/ssh-quick-connect.tsx` | Quick Connect dropdown |
| `src/renderer/components/ssh/ssh-connection-modal.tsx` | New connection form |

### Dependencies

```json
{
  "ssh2": "^1.16.0",
  "ssh-config": "^5.0.0"
}
```

Note: `chokidar` already exists in project (used by git-head-watcher).

---

## Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Connection drops on network issues | UX disruption | Auto-reconnect with backoff |
| Key passphrase handling | Security | Prefer SSH Agent, clear from memory after use |
| ~/.ssh/config parsing edge cases | Broken imports | Graceful fallback, show warnings |
| Performance with many SSH terminals | UI lag | Use ssh2's built-in multiplexing |
| Cross-platform SSH Agent | Doesn't work on Windows | Use Pageant integration for Windows |

---

## Success Metrics

1. **Connection reliability**: >99% successful connections to reachable hosts
2. **Reconnection speed**: <5s to reconnect after network recovery
3. **UX parity**: SSH terminals indistinguishable from local (except badge)
4. **Config compatibility**: Parse >95% of real-world ~/.ssh/config files
5. **Claude Code support**: Run Claude on remote servers seamlessly

---

## Out of Scope (Future)

- SFTP file transfer (shell only for now)
- SSH tunneling / port forwarding
- SSH key management (generate, upload)
- Jump host / ProxyCommand support

---

## Next Steps

1. Create detailed implementation plan
2. Set up ssh2 integration in sandbox branch
3. Implement Quick Connect UI prototype
4. Test with various SSH configs
