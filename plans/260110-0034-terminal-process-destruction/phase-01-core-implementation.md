# Phase 01: Core Implementation

## Context Links
- Parent: [plan.md](./plan.md)
- Docs: [codebase-summary.md](../docs/codebase-summary.md), [code-standards.md](../docs/code-standards.md)

## Overview
- **Priority**: P2
- **Status**: Done
- **Completed**: 2026-01-10
- **Description**: Implement async destroy methods with timeout and force kill

## Key Insights

1. Current `destroy()` is synchronous, returns boolean
2. `pty.kill()` sends SIGTERM equivalent, doesn't wait for exit
3. Windows `process.kill()` doesn't support SIGKILL - need `taskkill`
4. `onExit` event already registered in `create()` - need to handle double-delete

## Requirements

### Functional
- `destroyAsync(id)` returns `Promise<boolean>`, waits for graceful exit
- Force kill after 1000ms timeout if graceful fails
- Windows: use `taskkill /PID /T /F` for process tree killing
- Unix: use `process.kill(pid, 'SIGKILL')` for force kill
- `destroyAllAsync()` destroys all in parallel
- `hasTerminals()` helper for app quit handler

### Non-Functional
- Backward compatible: keep sync `destroy()` and `destroyAll()`
- No memory leaks: proper cleanup of event listeners
- Handle edge cases: process already dead, permission errors

## Architecture

```
destroy(id) [sync, existing]
    └── pty.kill() + map.delete()

destroyAsync(id) [new, async]
    ├── Try graceful: pty.kill()
    ├── Wait for onExit OR timeout (1000ms)
    ├── Timeout hit? → forceKill(term)
    └── Cleanup: clearTimeout, map.delete()

forceKill(term) [new, private]
    ├── Windows: execSync('taskkill /PID ${pid} /T /F')
    └── Unix: process.kill(pid, 'SIGKILL')

destroyAllAsync() [new, async]
    └── Promise.all(terminals.map(destroyAsync))
```

## Related Code Files

### Modify
| File | Changes |
|------|---------|
| `src/main/terminal/terminal-manager.ts` | Add `destroyAsync`, `forceKill`, `destroyAllAsync`, `hasTerminals` |

## Implementation Steps

### Step 1: Add Constants
```typescript
// At top of file
const DESTROY_TIMEOUT_MS = 1000
```

### Step 2: Add `forceKill` Private Method
```typescript
/**
 * Force kill process - platform specific
 * Windows: taskkill for process tree
 * Unix: SIGKILL
 */
private forceKill(term: PTYProcess): void {
  try {
    if (process.platform === 'win32') {
      const { execSync } = require('child_process')
      execSync(`taskkill /PID ${term.pty.pid} /T /F`, { stdio: 'ignore' })
    } else {
      process.kill(term.pty.pid, 'SIGKILL')
    }
  } catch {
    // Process already dead - ignore
  }
}
```

### Step 3: Add `destroyAsync` Method
```typescript
/**
 * Async destroy with graceful exit + force kill fallback
 * Tries graceful exit first, force kills after timeout
 */
async destroyAsync(id: string): Promise<boolean> {
  const term = this.terminals.get(id)
  if (!term) return false

  return new Promise((resolve) => {
    let resolved = false

    const cleanup = () => {
      if (resolved) return
      resolved = true
      clearTimeout(timeout)
      this.terminals.delete(id)
    }

    // Timeout handler - force kill if graceful fails
    const timeout = setTimeout(() => {
      if (resolved) return
      this.forceKill(term)
      cleanup()
      resolve(true)
    }, DESTROY_TIMEOUT_MS)

    // Listen for graceful exit
    const originalOnExit = term.pty.onExit
    term.pty.onExit(({ exitCode }) => {
      this.emit('exit', { terminalId: id, exitCode })
      cleanup()
      resolve(true)
    })

    // Initiate graceful kill
    term.pty.kill()
  })
}
```

### Step 4: Add `destroyAllAsync` Method
```typescript
/**
 * Async destroy all terminals in parallel
 */
async destroyAllAsync(): Promise<void> {
  const ids = Array.from(this.terminals.keys())
  await Promise.all(ids.map(id => this.destroyAsync(id)))
}
```

### Step 5: Add `hasTerminals` Helper
```typescript
/**
 * Check if any terminals exist
 */
hasTerminals(): boolean {
  return this.terminals.size > 0
}
```

## Todo List

- [x] Add DESTROY_TIMEOUT_MS constant
- [x] Implement forceKill() private method
- [x] Implement destroyAsync() method
- [x] Implement destroyAllAsync() method
- [x] Add hasTerminals() helper
- [x] Verify no duplicate onExit handling

## Success Criteria

- [x] `destroyAsync()` returns Promise that resolves after process exits
- [x] Force kill triggers after 2000ms timeout (updated from 1000ms)
- [x] Windows uses `taskkill /T /F` to kill process tree
- [x] Unix uses SIGKILL for force kill
- [x] No memory leaks from uncleared timeouts
- [x] Existing sync methods still work

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Duplicate onExit calls | Medium | Low | Guard with `resolved` flag |
| taskkill permission denied | Low | Low | Silent catch, log warning |
| Process already dead | Medium | None | Catch and ignore errors |

## Security Considerations

- `taskkill` only runs on PIDs we own (from our pty.spawn)
- No user input in command string
- Silent failures don't expose system state

## Next Steps

After this phase:
1. Update IPC handlers to use async methods
2. Update app quit handler
3. Update tests
