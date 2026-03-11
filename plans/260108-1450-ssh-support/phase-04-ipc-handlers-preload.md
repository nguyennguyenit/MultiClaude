# Phase 4: IPC Handlers & Preload

## Context

- Parent: [plan.md](./plan.md)
- Dependencies: [Phase 3](./phase-03-terminal-manager-extension.md)
- Docs: [code-standards.md](../../docs/code-standards.md)

## Overview

| Field | Value |
|-------|-------|
| Date | 2026-01-08 |
| Priority | P1 |
| Effort | 2h |
| Status | pending |
| Review | pending |

Register SSH IPC handlers and expose API to renderer via preload.

## Key Insights

- Follow existing handler patterns in handlers.ts
- Use invoke for request/response, send for events
- Expose typed API in preload like terminal namespace

## Requirements

1. Register SSH IPC handlers in handlers.ts
2. Forward SSH events to renderer
3. Expose SSH API in preload/index.ts
4. Type ElectronAPI with ssh namespace

## Architecture

### IPC Handler Registration

```typescript
// handlers.ts
export function registerSSHHandlers(
  terminalManager: TerminalManager,
  sshConfigWatcher: SSHConfigWatcher,
  sshProfileStore: SSHProfileStore
) {
  ipcMain.handle(IPC_CHANNELS.SSH_CREATE, async (_, config) => {
    return terminalManager.createSSH(config)
  })

  ipcMain.handle(IPC_CHANNELS.SSH_LIST_PROFILES, async () => {
    const configProfiles = sshConfigWatcher.getProfiles()
    const customProfiles = sshProfileStore.getProfiles()
    return [...configProfiles, ...customProfiles]
  })

  // ... more handlers
}
```

### Preload API

```typescript
// preload/index.ts
ssh: {
  create: (config: SSHConnectionConfig) =>
    ipcRenderer.invoke(IPC_CHANNELS.SSH_CREATE, config),
  destroy: (id: string) =>
    ipcRenderer.invoke(IPC_CHANNELS.SSH_DESTROY, id),
  reconnect: (id: string) =>
    ipcRenderer.invoke(IPC_CHANNELS.SSH_RECONNECT, id),
  listProfiles: () =>
    ipcRenderer.invoke(IPC_CHANNELS.SSH_LIST_PROFILES),
  saveProfile: (profile: SSHProfile) =>
    ipcRenderer.invoke(IPC_CHANNELS.SSH_SAVE_PROFILE, profile),
  deleteProfile: (id: string) =>
    ipcRenderer.invoke(IPC_CHANNELS.SSH_DELETE_PROFILE, id),
  testConnection: (config: SSHConnectionConfig) =>
    ipcRenderer.invoke(IPC_CHANNELS.SSH_TEST_CONNECTION, config),
  onStatusChanged: (callback) => {
    ipcRenderer.on(IPC_CHANNELS.SSH_STATUS_CHANGED, callback)
    return () => ipcRenderer.removeListener(...)
  },
  onAuthPrompt: (callback) => {
    ipcRenderer.on(IPC_CHANNELS.SSH_PROMPT_AUTH, callback)
    return () => ipcRenderer.removeListener(...)
  }
}
```

## Related Code Files

| File | Action |
|------|--------|
| `src/main/ipc/handlers.ts` | Modify |
| `src/main/ipc/ssh-handlers.ts` | Create (optional) |
| `src/preload/index.ts` | Modify |
| `src/main/index.ts` | Modify (init SSH) |

## Implementation Steps

1. Create ssh-handlers.ts or add to handlers.ts
2. Register handlers for all SSH channels
3. Forward SSH events (status, auth prompt) to renderer
4. Update preload to expose ssh namespace
5. Update ElectronAPI type with ssh methods
6. Initialize SSHConfigWatcher and SSHProfileStore in main/index.ts
7. Call registerSSHHandlers in main/index.ts

## Todo List

- [ ] Create registerSSHHandlers function
- [ ] Handle SSH_CREATE with terminalManager.createSSH
- [ ] Handle SSH_DESTROY with terminalManager.destroySSH
- [ ] Handle SSH_RECONNECT with terminalManager.reconnectSSH
- [ ] Handle SSH_LIST_PROFILES combining config + custom
- [ ] Handle SSH_SAVE_PROFILE with profileStore
- [ ] Handle SSH_DELETE_PROFILE with profileStore
- [ ] Handle SSH_TEST_CONNECTION for validation
- [ ] Forward statusChange event to SSH_STATUS_CHANGED
- [ ] Forward auth prompts to SSH_PROMPT_AUTH
- [ ] Add ssh namespace to preload
- [ ] Update ElectronAPI type
- [ ] Initialize SSH components in main/index.ts

## Success Criteria

- [ ] All SSH IPC handlers registered
- [ ] Preload exposes ssh.* methods
- [ ] TypeScript compiles without errors
- [ ] SSH status events reach renderer
- [ ] Auth prompts trigger callback in renderer

## Risk Assessment

| Risk | Impact | Mitigation |
|------|--------|------------|
| Handler name conflicts | Low | Use consistent SSH_ prefix |
| Async error handling | Medium | Wrap handlers in try/catch |

## Security Considerations

- Validate config before creating SSH connection
- Sanitize error messages (no sensitive data)
- Rate limit auth prompt responses

## Next Steps

After completion, proceed to [Phase 5: Renderer UI Components](./phase-05-renderer-ui-components.md)
