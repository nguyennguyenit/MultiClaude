# Phase 1: Types & IPC Channels

## Context

- Parent: [plan.md](./plan.md)
- Dependencies: None
- Docs: [code-standards.md](../../docs/code-standards.md)

## Overview

| Field | Value |
|-------|-------|
| Date | 2026-01-08 |
| Priority | P1 |
| Effort | 2h |
| Status | pending |
| Review | pending |

Define TypeScript types and IPC channels for SSH support.

## Key Insights

- Extend existing Terminal interface with SSH fields (backward compatible)
- Follow existing IPC channel naming pattern: `ssh:*`
- Keep types in shared layer for main/renderer access

## Requirements

1. Extend Terminal interface with SSH fields
2. Define SSHConnectionConfig, SSHProfile types
3. Add SSH IPC channels (create, destroy, connect, disconnect, list-profiles)
4. Define SSHStatus type for connection state

## Architecture

### Terminal Interface Extension

```typescript
interface Terminal {
  // ... existing fields
  connectionType: 'local' | 'ssh'
  sshConfig?: SSHConnectionConfig
  sshStatus?: SSHStatus
}

type SSHStatus = 'connecting' | 'connected' | 'disconnected' | 'error'

interface SSHConnectionConfig {
  host: string
  port: number
  username: string
  authMethod: 'key' | 'password' | 'agent'
  privateKeyPath?: string
  profileName?: string
}

interface SSHProfile {
  id: string
  name: string
  host: string
  port: number
  username: string
  authMethod: 'key' | 'password' | 'agent'
  privateKeyPath?: string
  isFromConfig: boolean // true if imported from ~/.ssh/config
  createdAt: Date
}
```

### IPC Channels

```typescript
// SSH channels
SSH_CREATE: 'ssh:create',
SSH_DESTROY: 'ssh:destroy',
SSH_RECONNECT: 'ssh:reconnect',
SSH_LIST_PROFILES: 'ssh:list-profiles',
SSH_SAVE_PROFILE: 'ssh:save-profile',
SSH_DELETE_PROFILE: 'ssh:delete-profile',
SSH_TEST_CONNECTION: 'ssh:test-connection',
SSH_STATUS_CHANGED: 'ssh:status-changed',
SSH_PROMPT_AUTH: 'ssh:prompt-auth',
```

## Related Code Files

| File | Action |
|------|--------|
| `src/shared/types/index.ts` | Modify |
| `src/shared/types/ssh.ts` | Create |
| `src/shared/constants/ipc-channels.ts` | Modify |

## Implementation Steps

1. Create `src/shared/types/ssh.ts` with SSH-specific types
2. Export SSH types from `src/shared/types/index.ts`
3. Extend Terminal interface with SSH fields (optional, backward compatible)
4. Add SSH channels to `src/shared/constants/ipc-channels.ts`

## Todo List

- [ ] Create ssh.ts with SSHConnectionConfig, SSHProfile, SSHStatus types
- [ ] Extend Terminal interface with connectionType, sshConfig, sshStatus
- [ ] Add SSH IPC channels to ipc-channels.ts
- [ ] Export new types from index.ts

## Success Criteria

- [ ] All SSH types compile without errors
- [ ] Existing Terminal usages remain compatible
- [ ] IPC channel names follow existing pattern
- [ ] Types documented with JSDoc comments

## Risk Assessment

| Risk | Impact | Mitigation |
|------|--------|------------|
| Breaking existing Terminal usage | High | Make new fields optional |
| Type naming conflicts | Low | Use SSH prefix consistently |

## Security Considerations

- Password type should not be stored in persistent types
- PrivateKeyPath stores path only, not key content
- Credential types only in memory/secure storage

## Next Steps

After completion, proceed to [Phase 2: SSH Core Infrastructure](./phase-02-ssh-core-infrastructure.md)
