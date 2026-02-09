# Phase 6: Polish & Testing

## Context

- Parent: [plan.md](./plan.md)
- Dependencies: [Phase 5](./phase-05-renderer-ui-components.md)
- Docs: [code-standards.md](../../docs/code-standards.md)

## Overview

| Field | Value |
|-------|-------|
| Date | 2026-01-08 |
| Priority | P1 |
| Effort | 1h |
| Status | pending |
| Review | pending |

Polish SSH feature, add error handling, reconnection logic, and tests.

## Key Insights

- Reconnection with exponential backoff (1s → 2s → 4s)
- Toast notifications for connection state changes
- Unit tests for SSH classes
- E2E test for SSH flow (mocked)

## Requirements

1. Exponential backoff reconnection
2. Toast notifications for SSH events
3. Error messages for common failures
4. Unit tests for core SSH classes
5. Cross-platform testing notes

## Architecture

### Reconnection Strategy

```typescript
class ReconnectionManager {
  private attempt = 0
  private maxAttempts = 3
  private baseDelay = 1000 // 1s

  async reconnect(connection: SSHConnection): Promise<boolean> {
    while (this.attempt < this.maxAttempts) {
      const delay = this.baseDelay * Math.pow(2, this.attempt)
      await sleep(delay)

      try {
        await connection.connect()
        this.attempt = 0
        return true
      } catch {
        this.attempt++
      }
    }
    return false // Show "Reconnect" button
  }
}
```

### Toast Notifications

| Event | Toast |
|-------|-------|
| Connecting | "Connecting to {host}..." |
| Connected | "Connected to {host}" ✓ |
| Disconnected | "Connection lost. Reconnecting..." |
| Reconnected | "Reconnected to {host}" ✓ |
| Failed | "Failed to connect after 3 attempts" ✗ |
| Auth failed | "Authentication failed: {reason}" ✗ |

### Error Messages

| Error | User Message |
|-------|--------------|
| ECONNREFUSED | "Connection refused. Is SSH running?" |
| ETIMEDOUT | "Connection timed out. Check host/port." |
| Auth failed | "Authentication failed. Check credentials." |
| Host key mismatch | "Host key changed. Verify server identity." |
| ENOENT (key file) | "Private key not found: {path}" |

## Related Code Files

| File | Action |
|------|--------|
| `src/main/ssh/ssh-connection.ts` | Modify (reconnection) |
| `src/main/ssh/__tests__/ssh-connection.spec.ts` | Create |
| `src/main/ssh/__tests__/ssh-config-watcher.spec.ts` | Create |
| `src/renderer/App.tsx` | Modify (toast notifications) |

## Implementation Steps

1. Add reconnection logic to SSHConnection
2. Implement exponential backoff
3. Add user-friendly error mapping
4. Setup toast notifications for SSH events
5. Write unit tests for SSHConnection
6. Write unit tests for SSHConfigWatcher
7. Document cross-platform considerations

## Todo List

- [ ] Add reconnect() with exponential backoff
- [ ] Map SSH errors to user-friendly messages
- [ ] Add toast notifications for SSH state changes
- [ ] Create ssh-connection.spec.ts
- [ ] Create ssh-config-watcher.spec.ts
- [ ] Test on Linux (primary)
- [ ] Document Windows Pageant setup
- [ ] Document macOS SSH Agent setup
- [ ] Add keyboard interrupt handling (Ctrl+C)

## Success Criteria

- [ ] Reconnection attempts with backoff
- [ ] User sees clear toast notifications
- [ ] Error messages actionable
- [ ] >60% test coverage for SSH module
- [ ] Works on Linux, macOS, Windows

## Risk Assessment

| Risk | Impact | Mitigation |
|------|--------|------------|
| Platform-specific issues | Medium | Test on all platforms before release |
| Test flakiness | Low | Use deterministic mocks for ssh2 |

## Security Considerations

- Log errors without sensitive data
- Don't expose internal errors to user
- Validate reconnection rate limiting

## Cross-Platform Notes

### Linux
- SSH Agent: Use `SSH_AUTH_SOCK` environment variable
- Default key locations: `~/.ssh/id_rsa`, `~/.ssh/id_ed25519`

### macOS
- SSH Agent: Use `SSH_AUTH_SOCK` or Keychain integration
- May need `ssh-add` for key passphrase

### Windows
- Pageant: Set `agent: 'pageant'` in ssh2 config
- OpenSSH Agent: Named pipe `\\.\pipe\openssh-ssh-agent`
- Key paths: `%USERPROFILE%\.ssh\`

## Next Steps

Feature complete. Proceed to code review and testing.
