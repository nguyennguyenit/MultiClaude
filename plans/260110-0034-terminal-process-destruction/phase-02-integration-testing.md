# Phase 02: Integration & Testing

## Context Links
- Parent: [plan.md](./plan.md)
- Depends on: [phase-01-core-implementation.md](./phase-01-core-implementation.md)

## Overview
- **Priority**: P2
- **Status**: Done
- **Description**: Update callers, app quit handler, and tests

## Key Insights

1. IPC handler at `handlers.ts:76` calls sync `destroy()` - can stay sync for now
2. App quit at `index.ts:121-129` calls sync `destroyAll()` - needs async update
3. Tests need async method coverage
4. Renderer calls via IPC - no direct changes needed

## Requirements

### Functional
- App quit waits for all terminals to close properly
- IPC handler optionally uses async (for better UX)
- Tests cover async methods, timeout, force kill scenarios

### Non-Functional
- App quit doesn't hang indefinitely (timeout handles this)
- Backward compatible - existing tests pass

## Architecture

### App Quit Flow (Updated)
```
window-all-closed event
    └── Check hasTerminals()
        ├── Yes: await destroyAllAsync()
        └── No: continue quit
    └── Cleanup other managers
    └── app.quit() (if not darwin)
```

## Related Code Files

### Modify
| File | Changes |
|------|---------|
| `src/main/index.ts` | Update `window-all-closed` handler |
| `src/main/ipc/handlers.ts` | Optional: use async for TERMINAL_DESTROY |
| `src/main/terminal/__tests__/terminal-manager.spec.ts` | Add async method tests |

## Implementation Steps

### Step 1: Update App Quit Handler (index.ts)

Replace lines 121-130:
```typescript
app.on('window-all-closed', async () => {
  // Cleanup terminals with proper process destruction
  if (terminalManager?.hasTerminals()) {
    await terminalManager.destroyAllAsync()
  }

  gitHeadWatcher?.destroy()
  notificationManager?.destroy()

  if (process.platform !== 'darwin') {
    app.quit()
  }
})
```

### Step 2: Update IPC Handler (Optional)

At `handlers.ts:74-77`, update to async:
```typescript
ipcMain.handle(IPC_CHANNELS.TERMINAL_DESTROY, async (_, id: string) => {
  notificationManager.clearTerminal(id)
  return terminalManager.destroyAsync(id)  // Use async version
})
```

### Step 3: Add Tests for Async Methods

Add to `terminal-manager.spec.ts`:

```typescript
describe('destroyAsync', () => {
  it('resolves after terminal exits', async () => {
    const term = manager.create()
    const promise = manager.destroyAsync(term.id)

    // Simulate exit
    mockPty._exitCallback?.({ exitCode: 0 })

    const result = await promise
    expect(result).toBe(true)
    expect(manager.get(term.id)).toBeUndefined()
  })

  it('force kills after timeout', async () => {
    vi.useFakeTimers()
    const term = manager.create()

    const promise = manager.destroyAsync(term.id)

    // Advance past timeout without exit
    vi.advanceTimersByTime(1001)

    const result = await promise
    expect(result).toBe(true)
    vi.useRealTimers()
  })

  it('returns false for non-existent terminal', async () => {
    const result = await manager.destroyAsync('invalid')
    expect(result).toBe(false)
  })
})

describe('destroyAllAsync', () => {
  it('destroys all terminals', async () => {
    manager.create()
    manager.create()
    expect(manager.list()).toHaveLength(2)

    // Simulate exits for all terminals
    setTimeout(() => {
      mockPty._exitCallback?.({ exitCode: 0 })
      mockPty._exitCallback?.({ exitCode: 0 })
    }, 10)

    await manager.destroyAllAsync()
    expect(manager.list()).toHaveLength(0)
  })
})

describe('hasTerminals', () => {
  it('returns false when no terminals', () => {
    expect(manager.hasTerminals()).toBe(false)
  })

  it('returns true when terminals exist', () => {
    manager.create()
    expect(manager.hasTerminals()).toBe(true)
  })
})
```

## Todo List

- [x] Update app quit handler to use async destroyAllAsync()
- [x] Update IPC handler to use destroyAsync()
- [x] Add destroyAsync() tests
- [x] Add destroyAllAsync() tests
- [x] Add hasTerminals() tests
- [x] Run full test suite
- [x] Manual test on Windows (if available)

## Success Criteria

- [x] App quits cleanly without orphan processes
- [x] All existing tests pass
- [x] New async method tests pass
- [x] Windows: subprocess tree properly killed (manual test)
- [x] Unix: force kill works after timeout

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Async quit hangs | Low | Medium | 1000ms timeout ensures no hang |
| Test timing issues | Medium | Low | Use fake timers |
| Windows test coverage | Medium | Low | Manual test if CI unavailable |

## Security Considerations

- No changes to security model
- Same IPC channel security as before

## Next Steps

After this phase:
- Feature complete
- Monitor for edge cases in production
- Consider adding telemetry for force kill frequency
